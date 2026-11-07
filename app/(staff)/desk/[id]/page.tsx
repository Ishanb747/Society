import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addComplaintNote, assignComplaint, changeStatus, dismissReview, resolveLinkedComplaints } from "@/app/actions/complaints";
import { CategoryMenu } from "@/components/category-menu";
import { SubmitButton } from "@/components/submit-button";
import { ResponseTimer } from "@/components/timer";
import { Timeline } from "@/components/timeline";
import { Card, Chip, Notice, SectionTitle, StatusChip, inputClass } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { CATEGORY_LABEL, OPEN_STATUSES, URGENCY_LABEL, type CategoryKey, type StatusKey, type UrgencyKey } from "@/lib/constants";
import { db } from "@/lib/db";
import { ago, fmtMinutes } from "@/lib/format";

export const metadata: Metadata = { title: "Complaint" };

export default async function DeskDetail({ params }: PageProps<"/desk/[id]">) {
  const { id } = await params;
  await requireStaff("desk");
  const c = await db.complaint.findUnique({
    where: { id },
    include: {
      flat: true, raisedBy: true, assignee: true, events: true,
      parent: { include: { flat: true } },
      duplicates: { include: { flat: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) notFound();
  const staff = await db.staff.findMany({ where: { role: { in: ["TECHNICIAN", "DUTY_MANAGER", "HELPDESK"] } }, orderBy: { name: "asc" } });
  const open = OPEN_STATUSES.includes(c.status);
  const openKids = c.duplicates.filter((d) => OPEN_STATUSES.includes(d.status)).length;
  const rootId = c.parentId ?? c.id;

  return (
    <div>
      <Link href="/desk" className="t-small link mb-4 inline-block text-fg-2">← Complaints</Link>
      {c.safetyEscalated && <p className="t-label mb-4 bg-ink px-4 py-2 text-on-ink">Safety · duty manager notified</p>}
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="t-small text-fg-3"><span className="tnum">#{c.seq}</span> · {c.flat.id} · {c.raisedBy.name} · {c.raisedBy.phone} · {ago(c.createdAt)}</p>
          <h1 className="t-h2 mt-2">{c.text}</h1>
          {c.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photoUrl} alt="Resident's photo" className="mt-4 max-h-72 w-auto rounded-sm border border-line" />
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusChip status={c.status as StatusKey} />
            <Chip tone={c.urgency === "CRITICAL" ? "danger" : c.urgency === "HIGH" ? "warn" : "neutral"}>{URGENCY_LABEL[c.urgency as UrgencyKey]}</Chip>
            {open && !c.firstResponseAt && <ResponseTimer dueBy={c.dueBy.toISOString()} createdAt={c.createdAt.toISOString()} />}
            {c.firstResponseAt && <span className="t-small text-fg-2">First response in {fmtMinutes((c.firstResponseAt.getTime() - c.createdAt.getTime()) / 60_000)}</span>}
            {c.reopenCount > 0 && <Chip tone="danger">Reopened {c.reopenCount}×</Chip>}
            {c.rating && <span className="t-small tnum text-fg-2">Rated {c.rating}/5</span>}
          </div>

          <SectionTitle>How it was classified</SectionTitle>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-fg-2">Category</span><CategoryMenu id={c.id} current={c.category} />
              <span className="t-small text-fg-3">
                {c.classifiedBy === "AI" && `AI, ${Math.round((c.aiConfidence ?? 0) * 100)}% sure`}
                {c.classifiedBy === "RULE" && "Safety rule (overrides AI)"}
                {c.classifiedBy === "FALLBACK" && "Keyword rules, AI unavailable or unsure"}
                {c.classifiedBy === "STAFF" && `Corrected by help desk${c.aiCategory ? `. AI said ${CATEGORY_LABEL[c.aiCategory as CategoryKey]}` : ""}`}
              </span>
            </div>
            {c.needsReview && (
              <Notice tone="warn">
                The system wasn&apos;t sure about this one. Check the category above.
                <form action={dismissReview} className="mt-2"><input type="hidden" name="id" value={c.id} /><SubmitButton small variant="outline" pending="Saving…">Category looks right</SubmitButton></form>
              </Notice>
            )}
          </Card>

          {(c.parent || c.duplicates.length > 0) && (
            <>
              <SectionTitle>Linked reports</SectionTitle>
              {c.parent && (
                <p className="mb-3 text-fg-2">This is a duplicate of <Link href={`/desk/${c.parent.id}`} className="link font-medium text-fg">#{c.parent.seq} ({c.parent.flat.id})</Link>. Linked, not closed.</p>
              )}
              {c.duplicates.length > 0 && (
                <>
                  <ul className="divide-y divide-line border-y border-line">
                    {c.duplicates.map((d) => (
                      <li key={d.id}>
                        <Link href={`/desk/${d.id}`} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                          <span><span className="tnum t-small text-fg-3">#{d.seq} · {d.flat.id}</span><span className="block line-clamp-1">{d.text}</span></span>
                          <StatusChip status={d.status as StatusKey} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {openKids > 0 && (
                    <form action={resolveLinkedComplaints} className="mt-3">
                      <input type="hidden" name="id" value={rootId} />
                      <SubmitButton variant="outline" small pending="Resolving…">Mark {openKids} linked as resolved too</SubmitButton>
                    </form>
                  )}
                </>
              )}
            </>
          )}

          <SectionTitle>Timeline</SectionTitle>
          <Timeline events={c.events} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card>
            <h2 className="t-h3">Status</h2>
            <form action={changeStatus} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <input name="note" maxLength={500} placeholder="Note for the resident (optional)" className={inputClass} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <SubmitButton name="status" value="IN_PROGRESS" variant="outline" small pending="…">In progress</SubmitButton>
                <SubmitButton name="status" value="RESOLVED" small pending="…">Resolved</SubmitButton>
                <SubmitButton name="status" value="CLOSED" variant="outline" small pending="…">Close</SubmitButton>
              </div>
            </form>
          </Card>
          <Card>
            <h2 className="t-h3">Assigned to</h2>
            <p className="mt-1 text-fg-2">{c.assignee?.name ?? "Nobody yet"}</p>
            <form action={assignComplaint} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={c.id} />
              <select name="assigneeId" defaultValue={c.assigneeId ?? ""} className={inputClass + " h-11"} aria-label="Assign to">
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <SubmitButton small variant="outline" pending="…">Assign</SubmitButton>
            </form>
          </Card>
          <Card>
            <h2 className="t-h3">Add a note</h2>
            <form action={addComplaintNote} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <textarea name="note" required maxLength={500} rows={3} placeholder="Visible to the resident" className="block w-full rounded-sm border border-line-2 p-3 text-[16px] focus:border-ink focus:outline-none" />
              <SubmitButton small variant="outline" pending="Saving…">Add note</SubmitButton>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
