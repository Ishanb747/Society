import { ago, fmtDateTime } from "@/lib/format";

export function Timeline({ events }: { events: { id: string; kind: string; note: string | null; createdAt: Date; actorKind: string }[] }) {
  const items = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <ol className="relative ml-1 border-l border-line-2 pl-6">
      {items.map((e, i) => (
        <li key={e.id} className="relative pb-6 last:pb-0">
          <span className={`absolute -left-[30px] top-1.5 size-2 rounded-full ${i === 0 ? "bg-ink" : "bg-line-2"}`} />
          <p className="font-medium capitalize-first">{e.note ?? e.kind.toLowerCase()}</p>
          <p className="t-small text-fg-3">
            {e.actorKind === "RESIDENT" ? "You" : e.actorKind === "STAFF" ? "Help desk" : "System"} · <time dateTime={e.createdAt.toISOString()} title={fmtDateTime(e.createdAt)}>{ago(e.createdAt)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
