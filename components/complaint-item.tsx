import Link from "next/link";
import { CATEGORY_LABEL, OPEN_STATUSES, type CategoryKey, type StatusKey } from "@/lib/constants";
import { fmtMinutes } from "@/lib/format";
import { Chip, StatusChip } from "./ui";
import { ResponseTimer } from "./timer";

export function ComplaintItem({ c }: {
  c: { id: string; seq: number; text: string; category: string; status: string; createdAt: Date; dueBy: Date; firstResponseAt: Date | null; safetyEscalated: boolean };
}) {
  const open = OPEN_STATUSES.includes(c.status as StatusKey);
  return (
    <Link href={`/complaints/${c.id}`} className="block rounded-md border border-line p-4 transition-colors hover:bg-surface-2">
      <div className="flex items-center justify-between gap-3">
        <p className="t-label text-fg-3">#{c.seq} · {CATEGORY_LABEL[c.category as CategoryKey]}</p>
        <StatusChip status={c.status as StatusKey} />
      </div>
      <p className="mt-2 line-clamp-2 text-[16px]">{c.text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {c.safetyEscalated && <Chip tone="danger">Escalated</Chip>}
        {open && !c.firstResponseAt && <ResponseTimer dueBy={c.dueBy.toISOString()} createdAt={c.createdAt.toISOString()} />}
        {open && c.firstResponseAt && <span className="t-small text-fg-2">Responded in {fmtMinutes((c.firstResponseAt.getTime() - c.createdAt.getTime()) / 60_000)}</span>}
      </div>
    </Link>
  );
}
