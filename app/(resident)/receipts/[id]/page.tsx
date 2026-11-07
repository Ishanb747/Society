import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Card, Chip } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { formatINR } from "@/lib/billing";
import { db } from "@/lib/db";
import { fmtDateLong, fmtMonth } from "@/lib/format";

export const metadata: Metadata = { title: "Receipt" };

export default async function Receipt({ params }: PageProps<"/receipts/[id]">) {
  const { id } = await params;
  const { user, flat } = await requireResident();
  const p = await db.payment.findFirst({ where: { id, flatId: flat.id, status: "SUCCEEDED" } });
  if (!p) notFound();
  const lines = await db.ledgerEntry.findMany({ where: { flatId: flat.id, refId: p.id }, orderBy: [{ period: "asc" }, { type: "asc" }] });
  const applied = lines.filter((l) => l.type === "PAYMENT");
  const fees = lines.filter((l) => l.type === "LATE_FEE");
  const credit = lines.filter((l) => l.type === "CREDIT");

  return (
    <div>
      <Link href="/bills" className="t-small link mb-4 inline-block text-fg-2 print:hidden">← Bills</Link>
      <Card className="print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="t-label text-fg-2">Payment receipt</p>
            <p className="tnum mt-1 font-medium">{p.receiptNo}</p>
          </div>
          <Chip tone="ok">Paid</Chip>
        </div>
        <p className="t-display tnum mt-6">{formatINR(p.amount)}</p>
        <p className="t-small mt-2 text-fg-2">{p.paidAt && fmtDateLong(p.paidAt)} · {p.method === "GATEWAY" ? "Paid in the app" : p.method}{p.utr ? ` · Ref ${p.utr}` : ""}</p>
        <dl className="t-small mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-line pt-5">
          <dt className="text-fg-2">Flat</dt><dd className="font-medium">{flat.id}</dd>
          <dt className="text-fg-2">Paid by</dt><dd className="font-medium">{user.name}</dd>
        </dl>
        <h2 className="t-label mb-2 mt-6 text-fg-2">Applied to</h2>
        <ul className="divide-y divide-line border-y border-line">
          {applied.map((l) => (
            <li key={l.id} className="t-small flex justify-between py-2.5"><span>{l.period ? fmtMonth(l.period) : "Maintenance"}</span><span className="tnum font-medium">{formatINR(Math.abs(l.amount))}</span></li>
          ))}
          {credit.map((l) => (
            <li key={l.id} className="t-small flex justify-between py-2.5"><span>{l.amount < 0 ? "Advance credit" : "Advance credit used"}</span><span className="tnum font-medium">{formatINR(Math.abs(l.amount))}</span></li>
          ))}
        </ul>
        {fees.length > 0 && <p className="t-small mt-3 text-fg-2">Includes late fee of {formatINR(fees.reduce((s, l) => s + l.amount, 0))} as per the society bye-laws.</p>}
        <div className="mt-6 print:hidden"><PrintButton /></div>
      </Card>
    </div>
  );
}
