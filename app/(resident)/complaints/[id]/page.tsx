import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { rateComplaint, reopenComplaint } from "@/app/actions/complaints";
import { ResponseTimer } from "@/components/timer";
import { Timeline } from "@/components/timeline";
import { SubmitButton } from "@/components/submit-button";
import { Card, Chip, Notice, SectionTitle, StatusChip, inputClass } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { CATEGORY_LABEL, OPEN_STATUSES, URGENCY_LABEL, type CategoryKey, type StatusKey, type UrgencyKey } from "@/lib/constants";
import { db } from "@/lib/db";
import { fmtMinutes } from "@/lib/format";

export const metadata: Metadata = { title: "Complaint" };

export default async function ComplaintDetail({ params }: PageProps<"/complaints/[id]">) {
  const { id } = await params;
  const { flat } = await requireResident();
  // Scoped to the resident's own flat: another flat's complaint is simply not found.
  const c = await db.complaint.findFirst({
    where: { id, flatId: flat.id },
    include: { events: true, assignee: true, parent: { include: { _count: { select: { duplicates: true } } } }, _count: { select: { duplicates: true } } },
  });
  if (!c) notFound();
  const open = OPEN_STATUSES.includes(c.status);
  const reportedBy = c._count.duplicates > 0 ? c._count.duplicates + 1 : c.parent ? c.parent._count.duplicates + 1 : 0;

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <Link href="/complaints" className="t-small link mb-4 inline-block text-fg-2">← Complaints</Link>
      <div className="flex items-center justify-between gap-3">
        <p className="t-label text-fg-3">#{c.seq} · {CATEGORY_LABEL[c.category as CategoryKey]} · {URGENCY_LABEL[c.urgency as UrgencyKey]}</p>
        <StatusChip status={c.status as StatusKey} />
      </div>
      <h1 className="t-h2 mt-3">{c.text}</h1>
      {c.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.photoUrl} alt="Photo you attached" className="mt-4 max-h-64 w-auto rounded-sm border border-line" />
      )}

      <div className="mt-4 space-y-3">
        {c.safetyEscalated && <Notice tone="danger">Flagged as a safety issue. The duty manager was alerted immediately.</Notice>}
        {reportedBy > 1 && <Notice tone="accent">{reportedBy} flats in your tower have reported this. We&apos;re treating it as one problem and will update everyone.</Notice>}
        {open && (
          <p>
            {c.firstResponseAt ? <span className="text-fg-2">First response in {fmtMinutes((c.firstResponseAt.getTime() - c.createdAt.getTime()) / 60_000)}.</span> : <ResponseTimer dueBy={c.dueBy.toISOString()} createdAt={c.createdAt.toISOString()} />}
            {c.assignee && <span className="text-fg-2"> Handled by {c.assignee.name}.</span>}
          </p>
        )}
      </div>

      {c.status === "RESOLVED" && (
        <Card className="mt-6">
          <h2 className="t-h3">Is it fixed?</h2>
          <p className="mt-1 text-fg-2">Rate the fix to close this complaint, or tell us if the problem is still there.</p>
          <form action={rateComplaint} className="mt-4">
            <input type="hidden" name="id" value={c.id} />
            <fieldset className="flex gap-2">
              <legend className="sr-only">Rating</legend>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="relative">
                  <input type="radio" name="rating" value={n} required defaultChecked={n === 5} className="peer sr-only" />
                  <span className="tnum flex size-12 cursor-pointer items-center justify-center rounded-sm border border-line-2 text-[16px] font-medium peer-checked:border-ink peer-checked:bg-ink peer-checked:text-on-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">{n}</span>
                </label>
              ))}
            </fieldset>
            <p className="t-small mt-2 text-fg-3">1 = poor, 5 = excellent</p>
            <div className="mt-4"><SubmitButton full pending="Saving…">Confirm fixed and close</SubmitButton></div>
          </form>
          <ReopenForm id={c.id} label="Not fixed yet" />
        </Card>
      )}
      {c.status === "CLOSED" && (
        <Card className="mt-6">
          <p className="flex items-center gap-2"><Chip tone="ok">Closed</Chip> {c.rating && <span className="tnum text-fg-2">You rated it {c.rating}/5</span>}</p>
          <ReopenForm id={c.id} label="It's back. Reopen" />
        </Card>
      )}

      <SectionTitle>Progress</SectionTitle>
      <Timeline events={c.events} />
    </div>
  );
}

function ReopenForm({ id, label }: { id: string; label: string }) {
  return (
    <details className="mt-4 border-t border-line pt-4">
      <summary className="t-small link cursor-pointer list-none font-medium">{label}</summary>
      <form action={reopenComplaint} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={id} />
        <input name="reason" maxLength={500} placeholder="What is still wrong? (optional)" className={inputClass} />
        <SubmitButton variant="danger" full pending="Reopening…">Reopen complaint</SubmitButton>
      </form>
    </details>
  );
}
