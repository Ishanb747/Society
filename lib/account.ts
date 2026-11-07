// Flat account maths. Pure functions: ledger rows in, balances and allocations out.
// The ledger is append-only: balances are always derived, never stored.
import { daysOverdue, lateFee } from "./billing";

export interface BillRow {
  period: string; // "2026-11"
  principal: number;
  dueDate: Date;
}

export type LedgerType = "BILL" | "LATE_FEE" | "PAYMENT" | "ADJUSTMENT" | "CREDIT";

export interface LedgerRow {
  type: LedgerType;
  amount: number; // signed: BILL / LATE_FEE > 0, PAYMENT / CREDIT < 0
  period: string | null;
  createdAt: Date;
}

export interface PeriodStatus {
  period: string;
  dueDate: Date;
  principal: number;
  paid: number;
  principalOutstanding: number;
  lateFeeOutstanding: number;
  lateFeeUnposted: number; // accrued but not yet written to the ledger
  outstanding: number;
  daysOverdue: number;
  status: "PAID" | "UPCOMING" | "DUE" | "OVERDUE";
}

export interface Account {
  periods: PeriodStatus[];
  totalOutstanding: number;
  credit: number;
  totalDue: number;
  overdueDays: number; // days overdue of the oldest unpaid bill
}

export function computeAccount(bills: BillRow[], ledger: LedgerRow[], now: Date): Account {
  const sorted = [...bills].sort((a, b) => a.period.localeCompare(b.period));
  const periods: PeriodStatus[] = sorted.map((bill) => {
    const rows = ledger.filter((l) => l.period === bill.period);
    const paid = -rows.filter((r) => r.type === "PAYMENT").reduce((s, r) => s + r.amount, 0);
    const posted = rows.filter((r) => r.type === "LATE_FEE").reduce((s, r) => s + r.amount, 0);
    // Payments settle the late fee first, then principal.
    const paidToFee = Math.min(paid, posted);
    const paidToPrincipal = paid - paidToFee;
    const principalOutstanding = Math.max(0, bill.principal - paidToPrincipal);
    const postedUnpaid = posted - paidToFee;
    const days = principalOutstanding > 0 ? daysOverdue(bill.dueDate, now) : 0;
    // ASSUMPTION: simple interest on the unpaid principal. Interest already written to the ledger
    // is never charged twice: new interest only accrues from the last posted late fee (or the
    // due date, if none has been posted yet).
    const lastPosted = rows.filter((r) => r.type === "LATE_FEE").reduce<Date | null>(
      (m, r) => (!m || r.createdAt > m ? r.createdAt : m),
      null,
    );
    const accrueFrom = lastPosted && lastPosted > bill.dueDate ? lastPosted : bill.dueDate;
    const lateFeeUnposted = principalOutstanding > 0 ? lateFee(principalOutstanding, daysOverdue(accrueFrom, now)) : 0;
    const lateFeeOutstanding = postedUnpaid + lateFeeUnposted;
    const outstanding = principalOutstanding + lateFeeOutstanding;
    let status: PeriodStatus["status"] = "PAID";
    if (outstanding > 0) {
      status = days > 0 ? "OVERDUE" : now >= startOfMonthOf(bill.period) ? "DUE" : "UPCOMING";
    }
    return {
      period: bill.period,
      dueDate: bill.dueDate,
      principal: bill.principal,
      paid,
      principalOutstanding,
      lateFeeOutstanding,
      lateFeeUnposted,
      outstanding,
      daysOverdue: days,
      status,
    };
  });

  const totalOutstanding = periods.reduce((s, p) => s + p.outstanding, 0);
  const credit = Math.max(0, -ledger.filter((l) => l.type === "CREDIT").reduce((s, l) => s + l.amount, 0));
  const overdueDays = periods.reduce((m, p) => (p.principalOutstanding > 0 ? Math.max(m, p.daysOverdue) : m), 0);
  return { periods, totalOutstanding, credit, totalDue: Math.max(0, totalOutstanding - credit), overdueDays };
}

function startOfMonthOf(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export interface NewLedgerEntry {
  type: LedgerType;
  amount: number;
  period: string | null;
  note: string;
}

export interface Allocation {
  entries: NewLedgerEntry[];
  applied: { period: string; toLateFee: number; toPrincipal: number }[];
  creditAdded: number; // overpayment kept as advance credit
  creditUsed: number;
}

/**
 * Splits a payment across the flat's unpaid periods, oldest first. Late fee is settled before
 * principal. Any existing advance credit is applied first, and any leftover becomes new credit.
 */
export function allocatePayment(account: Account, amount: number): Allocation {
  const entries: NewLedgerEntry[] = [];
  const applied: Allocation["applied"] = [];
  let remaining = amount + account.credit;

  for (const p of account.periods) {
    if (remaining <= 0) break;
    if (p.outstanding <= 0) continue;
    if (p.lateFeeUnposted > 0) {
      entries.push({ type: "LATE_FEE", amount: p.lateFeeUnposted, period: p.period, note: `Late fee, ${p.daysOverdue} days` });
    }
    const pay = Math.min(remaining, p.outstanding);
    const toFee = Math.min(pay, p.lateFeeOutstanding);
    entries.push({ type: "PAYMENT", amount: -pay, period: p.period, note: `Maintenance ${p.period}` });
    applied.push({ period: p.period, toLateFee: toFee, toPrincipal: pay - toFee });
    remaining -= pay;
  }

  // Existing credit is consumed first; whatever is left over (if anything) becomes credit again.
  const creditDelta = remaining - account.credit; // >0: new credit, <0: credit consumed
  if (creditDelta !== 0) {
    entries.push({
      type: "CREDIT",
      amount: -creditDelta,
      period: null,
      note: creditDelta > 0 ? "Advance credit from overpayment" : "Advance credit applied",
    });
  }
  return {
    entries,
    applied,
    creditAdded: Math.max(0, creditDelta),
    creditUsed: Math.max(0, -creditDelta),
  };
}
