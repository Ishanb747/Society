"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireResident } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadAccount, postPayment } from "@/lib/services/ledger";
import { payAmountSchema } from "@/lib/validation";

export type PayState = { error?: string };

export async function startPayment(_: PayState, formData: FormData): Promise<PayState> {
  const { flat } = await requireResident();
  const amount = payAmountSchema.safeParse(formData.get("amount"));
  if (!amount.success) return { error: amount.error.issues[0].message };
  const account = await loadAccount(flat.id);
  if (account.totalDue <= 0) return { error: "Nothing is due on this flat." };
  if (amount.data > account.totalDue) return { error: `The most you can pay is ₹${account.totalDue.toLocaleString("en-IN")}.` };
  const p = await db.payment.create({ data: { flatId: flat.id, amount: amount.data, method: "GATEWAY", source: "GATEWAY", status: "PENDING" } });
  redirect(`/pay/${p.id}`);
}

// Stands in for the payment gateway's callback. Test mode only: no money moves.
export async function completeMockPayment(formData: FormData) {
  const { flat } = await requireResident();
  const paymentId = z.string().min(1).parse(formData.get("paymentId"));
  const outcome = z.enum(["success", "fail", "cancel"]).parse(formData.get("outcome"));
  const payment = await db.payment.findFirst({ where: { id: paymentId, flatId: flat.id } });
  if (!payment) redirect("/bills");
  if (payment.status !== "PENDING") redirect(payment.status === "SUCCEEDED" ? `/receipts/${payment.id}` : "/bills");

  if (outcome === "success") {
    try {
      await postPayment({ flatId: flat.id, amount: payment.amount, method: "GATEWAY", source: "GATEWAY", paymentId: payment.id });
    } catch {
      redirect("/bills?payment=error");
    }
    revalidatePath("/", "layout");
    redirect(`/receipts/${payment.id}`);
  }
  if (outcome === "fail") await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
  revalidatePath("/bills");
  redirect(outcome === "fail" ? "/bills?payment=failed" : "/bills");
}
