import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { completeMockPayment } from "@/app/actions/payments";
import { SubmitButton } from "@/components/submit-button";
import { Card, Chip, PageHeader } from "@/components/ui";
import { requireResident } from "@/lib/auth";
import { formatINR } from "@/lib/billing";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Checkout" };

export default async function Checkout({ params }: PageProps<"/pay/[id]">) {
  const { id } = await params;
  const { flat } = await requireResident();
  const p = await db.payment.findFirst({ where: { id, flatId: flat.id } });
  if (!p) notFound();
  if (p.status === "SUCCEEDED") redirect(`/receipts/${p.id}`);
  if (p.status === "FAILED") redirect("/bills?payment=failed");

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader title="Checkout" eyebrow={flat.id} action={<Chip tone="warn">Test mode</Chip>} />
      <Card>
        <p className="t-label text-fg-2">You are paying</p>
        <p className="t-display tnum mt-3">{formatINR(p.amount)}</p>
        <p className="t-small mt-3 text-fg-2">Maintenance for {flat.id}. This is a simulated gateway: no real money moves.</p>
        <form action={completeMockPayment} className="mt-6 space-y-3">
          <input type="hidden" name="paymentId" value={p.id} />
          <SubmitButton name="outcome" value="success" variant="accent" full pending="Processing…">Pay {formatINR(p.amount)} (simulate success)</SubmitButton>
        </form>
        <form action={completeMockPayment} className="mt-3 grid grid-cols-2 gap-3">
          <input type="hidden" name="paymentId" value={p.id} />
          <button name="outcome" value="fail" className="h-12 rounded-sm border border-danger text-[15px] font-medium text-danger hover:bg-danger-soft">Simulate failure</button>
          <button name="outcome" value="cancel" className="h-12 rounded-sm border border-line-2 text-[15px] font-medium hover:bg-surface-2">Cancel</button>
        </form>
      </Card>
    </div>
  );
}
