import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { Card, Chip, SectionTitle, buttonClass } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { formatINR } from "@/lib/billing";
import { CATEGORY_LABEL, type CategoryKey } from "@/lib/constants";
import { fmtMinutes, fmtMonth } from "@/lib/format";
import { AGEING_BUCKETS, getDashboard } from "@/lib/services/dashboard";

export const metadata: Metadata = { title: "Committee report" };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const AGE_COLOR = ["bg-line-2", "bg-accent", "bg-warn", "bg-danger", "bg-ink"];

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "danger" }) {
  return (
    <div className="bg-surface p-5">
      <dt className="t-label text-fg-2">{label}</dt>
      <dd className={`t-display tnum mt-3 !text-[40px] ${tone === "danger" ? "text-danger" : tone === "ok" ? "text-ok" : ""}`}>{value}</dd>
      {sub && <p className="t-small mt-2 text-fg-2">{sub}</p>}
    </div>
  );
}

export default async function Committee() {
  await requireStaff("committee");
  const d = await getDashboard();
  const cur = d.currentMonth;
  const maxBilled = Math.max(1, ...d.byMonth.map((m) => m.billed));
  const ageTotal = d.ageing.reduce((s, a) => s + a.amount, 0);
  const c = d.complaints;
  const onTimePct = d.lastClosed ? pct(d.lastClosed.onTime, d.lastClosed.billedCount) : null;
  const maxCat = Math.max(1, ...c.byCategory.map((x) => x.total));

  return (
    <div>
      <header className="-mx-5 mb-8 bg-ink px-5 py-8 text-on-ink md:-mx-10 md:px-10">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-label text-on-ink-2">Committee report · {d.flats === 0 ? "" : `${d.flats} flats in this sample`}</p>
            <h1 className="t-h1 mt-2">{d.current ? fmtMonth(d.current) : "No bills yet"}</h1>
          </div>
          <div className="flex gap-3 print:hidden">
            <a href="/committee/export" className={buttonClass({ variant: "outline", small: true }) + " !border-on-ink !bg-transparent !text-on-ink hover:!bg-on-ink/10"}>Download CSV</a>
            <div className="w-44"><PrintButton /></div>
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Collected this month" value={cur ? formatINR(cur.collected) : "–"} sub={cur ? `${pct(cur.collected, cur.billed)}% of ${formatINR(cur.billed)} billed` : undefined} />
        <Kpi label="Paid on time, last month" value={onTimePct === null ? "–" : `${onTimePct}%`} sub="Target 90%. Baseline 70%." tone={onTimePct !== null && onTimePct >= 90 ? "ok" : undefined} />
        <Kpi label="Total outstanding" value={formatINR(d.totalOutstanding)} sub={`${d.flatsInArrears} flats overdue`} />
        <Kpi label="Complaints reopened" value={c.reopenPct === null ? "–" : `${c.reopenPct}%`} sub="Target under 8%. Baseline 25%." tone={c.reopenPct !== null && c.reopenPct < 8 ? "ok" : c.reopenPct !== null && c.reopenPct > 15 ? "danger" : undefined} />
      </dl>

      <SectionTitle>Collections by month</SectionTitle>
      <Card>
        <ul className="space-y-4">
          {[...d.byMonth].reverse().map((m) => (
            <li key={m.period} className="grid grid-cols-[88px_1fr_auto] items-center gap-4 md:grid-cols-[120px_1fr_200px]">
              <span className="t-small font-medium">{fmtMonth(m.period).replace(/ \d{4}$/, "")}</span>
              <div className="relative h-4 bg-surface-3" role="img" aria-label={`${fmtMonth(m.period)}: ${formatINR(m.collected)} of ${formatINR(m.billed)} collected`} style={{ width: `${(m.billed / maxBilled) * 100}%` }}>
                <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${Math.min(100, pct(m.collected, m.billed))}%` }} />
              </div>
              <span className="tnum t-small text-right text-fg-2"><b className="text-fg">{pct(m.collected, m.billed)}%</b> · {formatINR(m.collected)}</span>
            </li>
          ))}
        </ul>
        <p className="t-small mt-5 text-fg-3">Collected = payments applied to that month&apos;s bills, read from the ledger. Late payments count against the month they pay for.</p>
      </Card>

      <SectionTitle>Dues ageing</SectionTitle>
      <Card>
        <div className="flex h-6 w-full overflow-hidden rounded-sm bg-surface-3" role="img" aria-label="Outstanding dues by age">
          {d.ageing.map((a, i) => a.amount > 0 && <div key={a.label} className={AGE_COLOR[i]} style={{ width: `${pct(a.amount, ageTotal)}%` }} />)}
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {d.ageing.map((a, i) => (
            <li key={a.label}>
              <p className="t-label flex items-center gap-2 text-fg-2"><span className={`size-2.5 rounded-full ${AGE_COLOR[i]}`} />{AGEING_BUCKETS[i]}</p>
              <p className="tnum t-h3 mt-1">{formatINR(a.amount)}</p>
              <p className="t-small text-fg-3">{a.bills} bills</p>
            </li>
          ))}
        </ul>
      </Card>

      <SectionTitle>Complaints, last 60 days</SectionTitle>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line lg:grid-cols-4">
        <Kpi label="Avg first response" value={c.avgFirstResponseMin === null ? "–" : fmtMinutes(c.avgFirstResponseMin)} sub={c.targetMetPct === null ? undefined : `${c.targetMetPct}% within target`} />
        <Kpi label="Avg time to resolve" value={c.avgResolveHrs === null ? "–" : fmtMinutes(c.avgResolveHrs * 60)} sub={`${c.done} resolved`} />
        <Kpi label="Open now" value={String(c.open)} sub={c.breachedOpen ? `${c.breachedOpen} past response target` : "None past target"} tone={c.breachedOpen ? "danger" : undefined} />
        <Kpi label="Resident rating" value={c.avgRating === null ? "–" : `${c.avgRating.toFixed(1)}/5`} sub={`${c.safetyCount} safety escalations${c.safetyAvgResponseMin !== null ? `, ${fmtMinutes(c.safetyAvgResponseMin)} avg response` : ""}`} />
      </dl>
      <Card className="mt-4">
        <table className="w-full text-left">
          <thead><tr className="t-label border-b border-line text-fg-3"><th className="py-2 font-medium">Category</th><th className="font-medium">Volume</th><th className="hidden text-right font-medium sm:table-cell">Open</th><th className="text-right font-medium">Avg resolve</th></tr></thead>
          <tbody>
            {c.byCategory.map((x) => (
              <tr key={x.category} className="border-b border-line last:border-0">
                <td className="py-3 pr-3 font-medium">{CATEGORY_LABEL[x.category as CategoryKey]}</td>
                <td className="w-1/3 pr-3"><div className="flex items-center gap-2"><div className="h-2.5 bg-ink" style={{ width: `${pct(x.total, maxCat)}%`, minWidth: 4 }} /><span className="tnum t-small text-fg-2">{x.total}</span></div></td>
                <td className="tnum t-small hidden text-right sm:table-cell">{x.open}</td>
                <td className="tnum t-small text-right">{x.avgResolveHrs === null ? "–" : fmtMinutes(x.avgResolveHrs * 60)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionTitle>Can you trust these numbers?</SectionTitle>
      <Card className="space-y-3">
        <p className="flex flex-wrap items-center gap-2">
          <Chip tone={d.reconciliation.ok ? "ok" : "danger"}>{d.reconciliation.ok ? "Reconciled" : "Mismatch"}</Chip>
          Payments received {formatINR(d.reconciliation.received)} {d.reconciliation.ok ? "equal" : "do not equal"} credits in the ledger {formatINR(d.reconciliation.ledgerCredits)}.
        </p>
        <p className="text-fg-2">
          Bank matching: {d.bank.auto + d.bank.posted} rows posted ({d.bank.autoSharePct ?? 0}% automatically), <Link href="/desk/payments" className="link text-fg">{d.bank.review + d.bank.unmatched} waiting in the accounts queue</Link>. Nothing unclear is ever posted to a flat without a person.
        </p>
        <p className="t-small text-fg-3">Every figure is calculated live from the ledger and complaint records. Nothing on this page is typed in by hand.</p>
      </Card>
    </div>
  );
}
