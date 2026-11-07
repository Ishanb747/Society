import type { Metadata } from "next";
import { BankRowCard, type RowView } from "@/components/bank-row";
import { BankUpload } from "@/components/bank-upload";
import { Card, Chip, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { formatINR } from "@/lib/billing";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import type { Candidate } from "@/lib/matching/types";

export const metadata: Metadata = { title: "Payment matching" };

export default async function Payments() {
  await requireStaff("payments");
  const [queue, recent, counts] = await Promise.all([
    db.bankRow.findMany({ where: { status: { in: ["REVIEW", "UNMATCHED"] } }, orderBy: [{ status: "asc" }, { txnDate: "desc" }], take: 60 }),
    db.bankRow.findMany({ where: { status: { in: ["AUTO_POSTED", "POSTED"] } }, orderBy: { resolvedAt: "desc" }, take: 12 }),
    db.bankRow.groupBy({ by: ["status"], _count: true }),
  ]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  const ids = [...new Set([...queue.flatMap((r) => (r.candidates as Candidate[]).map((c) => c.flatId)), ...recent.map((r) => r.matchedFlatId).filter((x): x is string => !!x)])];
  const members = await db.membership.findMany({ where: { flatId: { in: ids } }, include: { user: true } });
  const who = (flatId: string) => members.filter((m) => m.flatId === flatId).map((m) => m.user.name).join(", ") || "Unknown";

  const rows: RowView[] = queue.map((r) => {
    const cands = r.candidates as Candidate[];
    return {
      id: r.id, date: fmtDate(r.txnDate), amount: r.amount, narration: r.narration, status: r.status as "REVIEW" | "UNMATCHED",
      reasons: r.status === "UNMATCHED" ? (r.reasons as string[]).slice(0, 1) : (r.reasons as string[]),
      suggested: r.suggestedFlatId ? { flatId: r.suggestedFlatId, who: who(r.suggestedFlatId) } : null,
      others: cands.filter((c) => c.flatId !== r.suggestedFlatId).map((c) => ({ flatId: c.flatId, who: who(c.flatId), score: c.score })),
    };
  });

  return (
    <div>
      <PageHeader title="Payment matching" eyebrow="Accounts" />
      <Card><BankUpload /></Card>

      <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line">
        {[["Posted automatically", n("AUTO_POSTED"), false], ["Needs review", n("REVIEW"), n("REVIEW") > 0], ["Unmatched", n("UNMATCHED"), n("UNMATCHED") > 0]].map(([l, v, alert]) => (
          <div key={l as string} className="bg-surface p-4"><dt className="t-label text-fg-2">{l}</dt><dd className={`t-h1 tnum mt-1 ${alert ? "text-warn" : ""}`}>{v as number}</dd></div>
        ))}
      </dl>
      <p className="t-small mt-3 text-fg-2">Only rows with a clear flat ID or registered UPI ID <em>and</em> the right amount are posted automatically. Everything else waits here for a person.</p>

      <SectionTitle>Accounts queue</SectionTitle>
      {rows.length === 0 ? (
        <EmptyState title="Queue is clear" body="Upload a statement to match new payments." />
      ) : (
        <ul className="divide-y divide-line border-y border-line">{rows.map((r) => <BankRowCard key={r.id} row={r} />)}</ul>
      )}

      <SectionTitle>Recently posted</SectionTitle>
      {recent.length === 0 ? (
        <p className="text-fg-2">Nothing posted from bank statements yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0">
                <span className="tnum font-medium">{formatINR(r.amount)}</span>
                <span className="t-small text-fg-2"> → {r.matchedFlatId} · {r.matchedFlatId ? who(r.matchedFlatId) : ""}</span>
                <span className="t-small block truncate font-mono text-fg-3">{r.narration}</span>
              </span>
              <Chip tone={r.status === "AUTO_POSTED" ? "ok" : "accent"}>{r.status === "AUTO_POSTED" ? "Auto" : "By accounts"}</Chip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
