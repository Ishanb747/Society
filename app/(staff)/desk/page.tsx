import type { Metadata } from "next";
import Link from "next/link";
import { CategoryMenu } from "@/components/category-menu";
import { ResponseTimer } from "@/components/timer";
import { Chip, EmptyState, PageHeader, StatusChip, buttonClass, inputClass } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { CATEGORIES, CATEGORY_LABEL, OPEN_STATUSES, URGENCIES, URGENCY_LABEL, type StatusKey, type UrgencyKey } from "@/lib/constants";
import { db } from "@/lib/db";
import { ago } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Complaints queue" };

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "review", label: "Needs review" },
  { key: "safety", label: "Safety" },
  { key: "closed", label: "Closed" },
] as const;

const BORDER: Record<UrgencyKey, string> = { LOW: "border-l-transparent", MEDIUM: "border-l-transparent", HIGH: "border-l-warn", CRITICAL: "border-l-danger" };

export default async function Desk({ searchParams }: PageProps<"/desk">) {
  const staff = await requireStaff("desk");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const view = VIEWS.find((v) => v.key === one(sp.view))?.key ?? "open";
  const cat = CATEGORIES.find((c) => c === one(sp.category));
  const urg = URGENCIES.find((u) => u === one(sp.urgency));
  const mine = one(sp.mine) === "1";

  const where: Prisma.ComplaintWhereInput = {
    parentId: null,
    ...(view === "open" && { status: { in: OPEN_STATUSES } }),
    ...(view === "review" && { needsReview: true, status: { in: OPEN_STATUSES } }),
    ...(view === "safety" && { safetyEscalated: true }),
    ...(view === "closed" && { status: { in: ["RESOLVED", "CLOSED"] } }),
    ...(cat && { category: cat }),
    ...(urg && { urgency: urg }),
    ...(mine && { assigneeId: staff.id }),
  };
  const now = new Date();
  const [list, counts] = await Promise.all([
    db.complaint.findMany({
      where,
      include: { flat: true, assignee: true, _count: { select: { duplicates: true } } },
      orderBy: view === "closed" ? { createdAt: "desc" } : [{ safetyEscalated: "desc" }, { urgency: "desc" }, { dueBy: "asc" }],
      take: 60,
    }),
    Promise.all([
      db.complaint.count({ where: { parentId: null, status: { in: OPEN_STATUSES } } }),
      db.complaint.count({ where: { needsReview: true, status: { in: OPEN_STATUSES } } }),
      db.complaint.count({ where: { safetyEscalated: true, status: { in: OPEN_STATUSES } } }),
      db.complaint.count({ where: { status: { in: OPEN_STATUSES }, firstResponseAt: null, dueBy: { lt: now } } }),
    ]),
  ]);
  const [open, review, safety, breached] = counts;
  const href = (v: string) => `/desk?view=${v}${cat ? `&category=${cat}` : ""}${urg ? `&urgency=${urg}` : ""}${mine ? "&mine=1" : ""}`;

  return (
    <div>
      <PageHeader title="Complaints" eyebrow="Help desk" />
      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-4">
        {[["Open", open, false], ["Needs review", review, review > 0], ["Safety, open", safety, safety > 0], ["Response overdue", breached, breached > 0]].map(([label, n, alert]) => (
          <div key={label as string} className="bg-surface p-4">
            <dt className="t-label text-fg-2">{label}</dt>
            <dd className={`t-h1 tnum mt-1 ${alert ? "text-danger" : ""}`}>{n as number}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <Link key={v.key} href={href(v.key)} aria-current={view === v.key ? "page" : undefined} className={`flex h-11 items-center rounded-full px-4 text-[15px] font-medium ${view === v.key ? "bg-ink text-on-ink" : "bg-surface-2 text-fg-2 hover:bg-surface-3"}`}>
            {v.label}
          </Link>
        ))}
      </div>
      <form className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value={view} />
        <label className="block"><span className="t-label mb-1 block text-fg-3">Category</span>
          <select name="category" defaultValue={cat ?? ""} className={inputClass + " h-11 w-44"}>
            <option value="">All</option>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select></label>
        <label className="block"><span className="t-label mb-1 block text-fg-3">Urgency</span>
          <select name="urgency" defaultValue={urg ?? ""} className={inputClass + " h-11 w-36"}>
            <option value="">All</option>{URGENCIES.map((u) => <option key={u} value={u}>{URGENCY_LABEL[u]}</option>)}
          </select></label>
        <label className="flex h-11 items-center gap-2 text-[15px]"><input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-5" /> Assigned to me</label>
        <button className={buttonClass({ variant: "outline", small: true })}>Apply</button>
        {(cat || urg || mine) && <Link href={`/desk?view=${view}`} className="t-small link h-11 leading-[44px] text-fg-2">Clear</Link>}
      </form>

      <div className="mt-6">
        {list.length === 0 ? (
          <EmptyState title="Nothing here" body={view === "open" ? "No open complaints match. Nice." : "No complaints match these filters."} />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {list.map((c) => {
              const isOpen = OPEN_STATUSES.includes(c.status);
              return (
                <li key={c.id}>
                  {c.safetyEscalated && isOpen && (
                    <p className="t-label bg-ink px-4 py-1.5 text-on-ink">Safety · duty manager notified</p>
                  )}
                  <div className={`grid gap-x-4 gap-y-2 border-l-[3px] py-4 pl-4 md:grid-cols-[1fr_auto] md:items-center ${BORDER[c.urgency as UrgencyKey]}`}>
                    <Link href={`/desk/${c.id}`} className="block min-w-0">
                      <p className="t-small text-fg-3">
                        <span className="tnum">#{c.seq}</span> · {c.flat.id} · {c.assignee?.name ?? "Unassigned"} · {ago(c.createdAt)}
                      </p>
                      <p className="mt-1 line-clamp-2 font-medium">{c.text}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-2">
                        {c._count.duplicates > 0 && <Chip tone="warn">+{c._count.duplicates} linked</Chip>}
                        {c.needsReview && <Chip tone="warn">Needs review</Chip>}
                        {c.classifiedBy === "STAFF" && <Chip>Corrected</Chip>}
                        {c.reopenCount > 0 && <Chip tone="danger">Reopened</Chip>}
                      </p>
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:justify-end">
                      <CategoryMenu id={c.id} current={c.category} />
                      <Chip tone={c.urgency === "CRITICAL" ? "danger" : c.urgency === "HIGH" ? "warn" : "neutral"}>{URGENCY_LABEL[c.urgency as UrgencyKey]}</Chip>
                      <StatusChip status={c.status as StatusKey} />
                      {isOpen && !c.firstResponseAt && <ResponseTimer dueBy={c.dueBy.toISOString()} createdAt={c.createdAt.toISOString()} />}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
