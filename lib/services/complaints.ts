import { db } from "@/lib/db";
import { classifyComplaint } from "@/lib/complaints/classify";
import { pickAssignee, type StaffLoad } from "@/lib/complaints/assign";
import { findDuplicateParent } from "@/lib/complaints/duplicates";
import { CATEGORY_LABEL, OPEN_STATUSES, RESPONSE_TARGET_MIN, type CategoryKey, type StatusKey } from "@/lib/constants";

type Actor = { kind: "RESIDENT" | "STAFF" | "SYSTEM"; staffId?: string };

const event = (complaintId: string, actor: Actor, kind: string, note?: string) => ({
  complaintId, kind, note: note ?? null, actorKind: actor.kind, actorStaffId: actor.staffId ?? null,
});

async function staffLoads(): Promise<StaffLoad[]> {
  const staff = await db.staff.findMany({ include: { _count: { select: { assigned: { where: { status: { in: OPEN_STATUSES } } } } } } });
  return staff.map((s) => ({ id: s.id, role: s.role, skills: s.skills as CategoryKey[], openCount: s._count.assigned }));
}

export async function createComplaint(input: { userId: string; flatId: string; text: string; photoUrl?: string | null }) {
  const flat = await db.flat.findUniqueOrThrow({ where: { id: input.flatId } });
  const now = new Date();
  const cls = await classifyComplaint(input.text);

  const recent = await db.complaint.findMany({
    where: { flat: { tower: flat.tower }, createdAt: { gte: new Date(now.getTime() - 24 * 3600_000) }, status: { in: [...OPEN_STATUSES, "RESOLVED"] } },
    select: { id: true, category: true, text: true, createdAt: true, parentId: true },
  });
  const parentId = findDuplicateParent(
    { category: cls.category, text: input.text, tower: flat.tower, createdAt: now },
    recent.map((c) => ({ ...c, category: c.category as CategoryKey, tower: flat.tower })),
  );
  const assigneeId = pickAssignee(await staffLoads(), cls.category, cls.safetyEscalated);

  const c = await db.complaint.create({
    data: {
      flatId: input.flatId,
      raisedById: input.userId,
      text: input.text,
      photoUrl: input.photoUrl ?? null,
      category: cls.category,
      urgency: cls.urgency,
      aiCategory: cls.ai?.category,
      aiUrgency: cls.ai?.urgency,
      aiConfidence: cls.ai?.confidence,
      classifiedBy: cls.classifiedBy,
      needsReview: cls.needsReview,
      safetyEscalated: cls.safetyEscalated,
      assigneeId,
      status: assigneeId ? "ASSIGNED" : "NEW",
      parentId,
      dueBy: new Date(now.getTime() + RESPONSE_TARGET_MIN[cls.urgency] * 60_000),
    },
  });
  const assignee = assigneeId ? await db.staff.findUnique({ where: { id: assigneeId } }) : null;
  await db.complaintEvent.createMany({
    data: [
      event(c.id, { kind: "RESIDENT" }, "CREATED", "Complaint raised"),
      event(c.id, { kind: "SYSTEM" }, "CLASSIFIED", `${CATEGORY_LABEL[cls.category]} · ${cls.urgency.toLowerCase()}. ${cls.note}`),
      ...(assignee ? [event(c.id, { kind: "SYSTEM" }, "ASSIGNED", `Assigned to ${assignee.name}`)] : []),
      ...(parentId ? [event(c.id, { kind: "SYSTEM" }, "LINKED", "Linked to an earlier report of the same issue. Not closed.")] : []),
    ],
  });
  if (parentId) {
    await db.complaintEvent.create({ data: event(parentId, { kind: "SYSTEM" }, "LINKED", `Another flat reported the same issue (#${c.seq})`) });
  }
  return c;
}

function isFirstResponse(c: { firstResponseAt: Date | null }) {
  return c.firstResponseAt ? {} : { firstResponseAt: new Date() };
}

export async function setStatus(id: string, status: StatusKey, staffId: string, note?: string) {
  const c = await db.complaint.findUniqueOrThrow({ where: { id } });
  if (status === "REOPENED" || status === "NEW") throw new Error("Residents reopen; staff cannot set this status");
  const now = new Date();
  await db.complaint.update({
    where: { id },
    data: {
      status,
      ...isFirstResponse(c),
      ...(status === "RESOLVED" ? { resolvedAt: now } : {}),
      ...(status === "CLOSED" && !c.resolvedAt ? { resolvedAt: now } : {}),
    },
  });
  await db.complaintEvent.create({ data: event(id, { kind: "STAFF", staffId }, "STATUS", note ? `${status.replace("_", " ").toLowerCase()}: ${note}` : status.replace("_", " ").toLowerCase()) });
}

export async function recategorise(id: string, category: CategoryKey, staffId: string) {
  const c = await db.complaint.findUniqueOrThrow({ where: { id } });
  if (c.category === category) return;
  const assigneeId = c.safetyEscalated ? c.assigneeId : pickAssignee(await staffLoads(), category, false) ?? c.assigneeId;
  await db.complaint.update({
    where: { id },
    data: { category, classifiedBy: "STAFF", needsReview: false, assigneeId, ...isFirstResponse(c) },
  });
  await db.complaintEvent.create({
    data: event(id, { kind: "STAFF", staffId }, "RECATEGORISED", `${CATEGORY_LABEL[c.category as CategoryKey]} → ${CATEGORY_LABEL[category]}`),
  });
}

export async function assignTo(id: string, assigneeId: string, staffId: string) {
  const c = await db.complaint.findUniqueOrThrow({ where: { id } });
  const to = await db.staff.findUniqueOrThrow({ where: { id: assigneeId } });
  await db.complaint.update({
    where: { id },
    data: { assigneeId, status: c.status === "NEW" ? "ASSIGNED" : c.status, ...isFirstResponse(c) },
  });
  await db.complaintEvent.create({ data: event(id, { kind: "STAFF", staffId }, "ASSIGNED", `Assigned to ${to.name}`) });
}

export async function addNote(id: string, note: string, staffId: string) {
  const c = await db.complaint.findUniqueOrThrow({ where: { id } });
  await db.complaint.update({ where: { id }, data: isFirstResponse(c) });
  await db.complaintEvent.create({ data: event(id, { kind: "STAFF", staffId }, "NOTE", note) });
}

/** Staff decision: mark every linked duplicate resolved too. Never automatic. */
export async function resolveLinked(parentId: string, staffId: string) {
  const kids = await db.complaint.findMany({ where: { parentId, status: { in: OPEN_STATUSES } } });
  const now = new Date();
  for (const k of kids) {
    await db.complaint.update({ where: { id: k.id }, data: { status: "RESOLVED", resolvedAt: now, ...isFirstResponse(k) } });
    await db.complaintEvent.create({ data: event(k.id, { kind: "STAFF", staffId }, "STATUS", "resolved together with the linked complaint") });
  }
  return kids.length;
}

/** Resident confirms the fix and rates it. */
export async function rateAndClose(id: string, flatId: string, rating: number) {
  const r = await db.complaint.updateMany({ where: { id, flatId, status: "RESOLVED" }, data: { rating, status: "CLOSED" } });
  if (r.count) await db.complaintEvent.create({ data: event(id, { kind: "RESIDENT" }, "RATED", `Closed with ${rating}/5`) });
  return r.count > 0;
}

/** Resident says it is not fixed. Restarts the response timer. */
export async function reopen(id: string, flatId: string, reason?: string) {
  const c = await db.complaint.findFirst({ where: { id, flatId, status: { in: ["RESOLVED", "CLOSED"] } } });
  if (!c) return false;
  await db.complaint.update({
    where: { id },
    data: {
      status: "REOPENED",
      reopenCount: { increment: 1 },
      resolvedAt: null,
      rating: null,
      dueBy: new Date(Date.now() + RESPONSE_TARGET_MIN[c.urgency as keyof typeof RESPONSE_TARGET_MIN] * 60_000),
    },
  });
  await db.complaintEvent.create({ data: event(id, { kind: "RESIDENT" }, "REOPENED", reason || "Resident says the problem is not fixed") });
  return true;
}
