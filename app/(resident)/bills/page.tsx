import type { Metadata } from "next";
import Link from "next/link";
import { PayForm } from "@/components/pay-form";
import { Card, Chip, EmptyState, Notice, PageHeader, SectionTitle } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { formatINR, RATE_PER_SQFT } from "@/lib/billing";
import { db } from "@/lib/db";
import { fmtDate, fmtMonth } from "@/lib/format";
import { loadAccount } from "@/lib/services/ledger";

export const metadata: Metadata = { title: "Bills" };

export default async function Bills({ searchParams }: PageProps<"/bills">) {
  const { flat } = await requireResident();
  const sp = await searchParams;
  const [account, payments, ledger] = await Promise.all([
    loadAccount(flat.id),
    db.payment.findMany({ where: { flatId: flat.id, status: "SUCCEEDED" }, orderBy: { paidAt: "desc" }, take: 8 }),
    db.ledgerEntry.findMany({ where: { flatId: flat.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const periods = [...account.periods].reverse();
  const payBanner = sp.payment;

  return (
    <div>
      <PageHeader title="Bills" eyebrow={`${flat.id} · ${flat.areaSqft} sq ft × ₹${RATE_PER_SQFT.toFixed(2)}`} />
      {payBanner === "failed" && <div className="mb-4"><Notice>The payment didn&apos;t go through and you haven&apos;t been charged. You can try again.</Notice></div>}
      {payBanner === "error" && <div className="mb-4"><Notice>We couldn&apos;t record that payment. Nothing was charged. Please try again.</Notice></div>}

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
      <div>
      <Card>
        <p className="t-label text-fg-2">Total due</p>
        <p className="t-display tnum mt-3">{formatINR(account.totalDue)}</p>
        {account.credit > 0 && <p className="t-small mt-2 text-fg-2">{formatINR(account.credit)} advance credit applied</p>}
        {account.totalDue > 0 ? (
          <div className="mt-6"><PayForm total={account.totalDue} /></div>
        ) : (
          <p className="mt-3 text-ok">You&apos;re all paid up. Thank you.</p>
        )}
      </Card>

      <SectionTitle>Monthly bills</SectionTitle>
      {periods.length === 0 ? (
        <EmptyState title="No bills yet" body="Your first maintenance bill will appear here on the 1st." />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {periods.map((p) => (
            <li key={p.period} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{fmtMonth(p.period)}</p>
                <p className="t-small text-fg-2">
                  {p.status === "PAID" ? `Paid ${formatINR(p.paid)}` : `Due ${fmtDate(p.dueDate)}`}
                  {p.lateFeeOutstanding > 0 && ` · late fee ${formatINR(p.lateFeeOutstanding)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="tnum font-medium">{formatINR(p.principal)}</p>
                {p.status === "PAID" ? <Chip tone="ok">Paid</Chip> : p.status === "OVERDUE" ? <Chip tone="danger">{p.daysOverdue}d overdue</Chip> : <Chip tone="warn">{p.paid > 0 ? `${formatINR(p.outstanding)} left` : "Due"}</Chip>}
              </div>
            </li>
          ))}
        </ul>
      )}

      </div>
      <div>
      <SectionTitle className="lg:!mt-0">Receipts</SectionTitle>
      {payments.length === 0 ? (
        <EmptyState title="No payments yet" body="Receipts for your payments will show up here." />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {payments.map((p) => (
            <li key={p.id}>
              <Link href={`/receipts/${p.id}`} className="flex min-h-14 items-center justify-between gap-4 py-3">
                <span>
                  <span className="tnum block font-medium">{formatINR(p.amount)}</span>
                  <span className="t-small text-fg-2">{p.paidAt && fmtDate(p.paidAt)} · {p.method === "GATEWAY" ? "App" : p.method} · {p.receiptNo}</span>
                </span>
                <span className="t-small link text-fg-2">View</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Ledger</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left">
          <thead>
            <tr className="t-label border-b border-line text-fg-3"><th className="py-2 font-medium">Date</th><th className="font-medium">Entry</th><th className="text-right font-medium">Amount</th></tr>
          </thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="t-small py-3 text-fg-2">{fmtDate(l.createdAt)}</td>
                <td className="t-small py-3">{l.note ?? l.type}</td>
                <td className={`tnum t-small py-3 text-right font-medium ${l.amount < 0 ? "text-ok" : ""}`}>{l.amount < 0 ? "−" : ""}{formatINR(Math.abs(l.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
      </div>
    </div>
  );
}
