import type { Prisma } from "@/generated/prisma/client";
import { allocatePayment, computeAccount, type Account } from "@/lib/account";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export async function loadAccount(flatId: string, now = new Date(), client: Tx | typeof db = db): Promise<Account> {
  const [bills, ledger] = await Promise.all([
    client.bill.findMany({ where: { flatId } }),
    client.ledgerEntry.findMany({ where: { flatId } }),
  ]);
  return computeAccount(bills, ledger, now);
}

export interface PostPaymentInput {
  flatId: string;
  amount: number;
  method: "UPI" | "NEFT" | "CHEQUE" | "GATEWAY";
  source: "GATEWAY" | "BANK";
  utr?: string | null;
  paidAt?: Date;
  paymentId?: string; // complete an existing PENDING payment
}

/**
 * Records a successful payment and writes the ledger entries that settle the flat's oldest dues.
 * Runs in one transaction so a payment is never half-posted.
 */
export async function postPayment(input: PostPaymentInput, client: typeof db = db) {
  return client.$transaction(async (tx) => {
    // Completing a pending gateway payment: claim it first so a double click can never post twice.
    if (input.paymentId) {
      const claim = await tx.payment.updateMany({ where: { id: input.paymentId, status: "PENDING" }, data: { status: "SUCCEEDED" } });
      if (claim.count === 0) throw new Error("Payment is not pending");
    }
    const paidAt = input.paidAt ?? new Date();
    const account = await loadAccount(input.flatId, paidAt, tx);
    const alloc = allocatePayment(account, input.amount);

    const count = await tx.payment.count({ where: { receiptNo: { not: null } } });
    const receiptNo = `RCT-${paidAt.getUTCFullYear()}-${String(count + 1).padStart(6, "0")}`;
    const data = {
      flatId: input.flatId,
      amount: input.amount,
      method: input.method,
      source: input.source,
      utr: input.utr ?? null,
      status: "SUCCEEDED" as const,
      paidAt,
      receiptNo,
    };
    const payment = input.paymentId
      ? await tx.payment.update({ where: { id: input.paymentId }, data })
      : await tx.payment.create({ data });

    await tx.ledgerEntry.createMany({
      data: alloc.entries.map((e) => ({
        flatId: input.flatId,
        type: e.type,
        amount: e.amount,
        period: e.period,
        refType: e.type === "PAYMENT" || e.type === "CREDIT" ? "PAYMENT" : "LATE_FEE",
        refId: payment.id,
        note: e.note,
        createdAt: paidAt,
      })),
    });
    return { payment, allocation: alloc };
  });
}
