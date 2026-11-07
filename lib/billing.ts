// Billing rules. Pure functions only: no DB, no clock reads (callers pass `now`).

// Rate from the client brief: Rs 6.50 per sq ft per month.
export const RATE_PER_SQFT = 6.5;

// ASSUMPTION: bills are issued on the 1st and are due on the 10th of the month.
export const DUE_DAY = 10;

// ASSUMPTION: the brief says late fees follow the society's bye-laws but does not give the rate.
// We use 21% a year simple interest on overdue principal, accrued daily. One constant to change.
export const LATE_FEE_ANNUAL_RATE = 0.21;

const MS_PER_DAY = 86_400_000;

export function monthlyBill(areaSqft: number): number {
  return Math.round(areaSqft * RATE_PER_SQFT);
}

/** Whole days from `due` to `now`, never negative. Dates compared as UTC calendar days. */
export function daysOverdue(due: Date, now: Date): number {
  const d = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const n = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((n - d) / MS_PER_DAY));
}

/** Simple interest on the unpaid principal for the days overdue, rounded to whole rupees. */
export function lateFee(unpaidPrincipal: number, daysLate: number): number {
  if (unpaidPrincipal <= 0 || daysLate <= 0) return 0;
  return Math.round((unpaidPrincipal * LATE_FEE_ANNUAL_RATE * daysLate) / 365);
}

export function dueDateFor(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, DUE_DAY));
}

/** Indian digit grouping, no paise unless needed. 1234567 -> "₹12,34,567". */
export function formatINR(rupees: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}
