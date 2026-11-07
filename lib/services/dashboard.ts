import { computeAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { OPEN_STATUSES } from "@/lib/constants";

const DAY = 86_400_000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const AGEING_BUCKETS = ["Not yet due", "1–30 days", "31–60 days", "61–90 days", "Over 90 days"] as const;
const bucketOf = (days: number) => (days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4);

export async function getDashboard(now = new Date()) {
  const [flats, bills, ledger, payments, complaints, rows] = await Promise.all([
    db.flat.count(),
    db.bill.findMany(),
    db.ledgerEntry.findMany({ select: { flatId: true, type: true, amount: true, period: true, createdAt: true } }),
    db.payment.findMany({ where: { status: "SUCCEEDED" }, select: { amount: true } }),
    db.complaint.findMany({ where: { createdAt: { gte: new Date(now.getTime() - 60 * DAY) } }, include: { flat: { select: { tower: true } } } }),
    db.bankRow.groupBy({ by: ["status"], _count: true }),
  ]);

  const periods = [...new Set(bills.map((b) => b.period))].sort();
  const current = periods.at(-1) ?? "";
  const billsBy = Map.groupBy(bills, (b) => b.flatId);
  const ledgerBy = Map.groupBy(ledger, (l) => l.flatId);

  // Collections by month: payments applied to each month's bills, against what was billed
  const byMonth = periods.map((p) => {
    const billed = bills.filter((b) => b.period === p).reduce((s, b) => s + b.principal, 0);
    const collected = -ledger.filter((l) => l.period === p && l.type === "PAYMENT").reduce((s, l) => s + l.amount, 0);
    // On time = bill fully paid on or before the due date (end of day)
    const dueBills = bills.filter((b) => b.period === p);
    const onTime = dueBills.filter((b) => {
      const cutoff = b.dueDate.getTime() + DAY;
      const paid = -ledger.filter((l) => l.flatId === b.flatId && l.period === p && l.type === "PAYMENT" && l.createdAt.getTime() <= cutoff).reduce((s, l) => s + l.amount, 0);
      return paid >= b.principal;
    }).length;
    return { period: p, billed, collected, billedCount: dueBills.length, onTime, dueDate: dueBills[0]?.dueDate ?? now };
  });
  const closed = byMonth.filter((m) => m.dueDate.getTime() + DAY < now.getTime());
  const lastClosed = closed.at(-1);

  // Dues ageing: every unpaid bill, bucketed by how late it is today
  const ageing = AGEING_BUCKETS.map((label) => ({ label, amount: 0, bills: 0 }));
  let totalOutstanding = 0;
  let flatsInArrears = 0;
  for (const [flatId, fb] of billsBy) {
    const acct = computeAccount(fb, ledgerBy.get(flatId) ?? [], now);
    totalOutstanding += acct.totalDue;
    if (acct.overdueDays > 0) flatsInArrears++;
    for (const p of acct.periods) {
      if (p.outstanding <= 0) continue;
      const b = ageing[bucketOf(p.daysOverdue)];
      b.amount += p.outstanding;
      b.bills++;
    }
  }

  // Ledger reconciliation: cash received must equal the credits the ledger recorded
  const received = payments.reduce((s, p) => s + p.amount, 0);
  const ledgerCredits = -ledger.filter((l) => l.type === "PAYMENT" || l.type === "CREDIT").reduce((s, l) => s + l.amount, 0);

  // Complaints, last 60 days
  const done = complaints.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
  const firstResponses = complaints.filter((c) => c.firstResponseAt).map((c) => (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60_000);
  const resolveHrs = done.filter((c) => c.resolvedAt).map((c) => (c.resolvedAt!.getTime() - c.createdAt.getTime()) / 3_600_000);
  const withinTarget = complaints.filter((c) => c.firstResponseAt && c.firstResponseAt <= c.dueBy).length;
  const responded = complaints.filter((c) => c.firstResponseAt).length;
  const reopened = done.filter((c) => c.reopenCount > 0).length;
  const ratings = complaints.filter((c) => c.rating).map((c) => c.rating!);
  const open = complaints.filter((c) => OPEN_STATUSES.includes(c.status));
  const byCategory = [...Map.groupBy(complaints, (c) => c.category)].map(([category, cs]) => {
    const d = cs.filter((c) => c.resolvedAt);
    return {
      category, total: cs.length, open: cs.filter((c) => OPEN_STATUSES.includes(c.status)).length,
      avgResolveHrs: avg(d.map((c) => (c.resolvedAt!.getTime() - c.createdAt.getTime()) / 3_600_000)),
    };
  }).sort((a, b) => b.total - a.total);
  const safety = complaints.filter((c) => c.safetyEscalated);

  const bank = Object.fromEntries(rows.map((r) => [r.status, r._count])) as Record<string, number>;
  const matched = (bank.AUTO_POSTED ?? 0) + (bank.POSTED ?? 0);

  return {
    flats, current, byMonth, lastClosed,
    currentMonth: byMonth.at(-1),
    ageing, totalOutstanding, flatsInArrears,
    reconciliation: { received, ledgerCredits, ok: received === ledgerCredits },
    complaints: {
      total: complaints.length, open: open.length, done: done.length,
      avgFirstResponseMin: avg(firstResponses), avgResolveHrs: avg(resolveHrs),
      targetMetPct: responded ? Math.round((withinTarget / responded) * 100) : null,
      reopenPct: done.length ? Math.round((reopened / done.length) * 1000) / 10 : null,
      avgRating: avg(ratings), byCategory,
      safetyCount: safety.length,
      safetyAvgResponseMin: avg(safety.filter((c) => c.firstResponseAt).map((c) => (c.firstResponseAt!.getTime() - c.createdAt.getTime()) / 60_000)),
      breachedOpen: open.filter((c) => !c.firstResponseAt && c.dueBy < now).length,
    },
    bank: { auto: bank.AUTO_POSTED ?? 0, posted: bank.POSTED ?? 0, review: bank.REVIEW ?? 0, unmatched: bank.UNMATCHED ?? 0, ignored: bank.IGNORED ?? 0, autoSharePct: matched ? Math.round(((bank.AUTO_POSTED ?? 0) / matched) * 100) : null },
  };
}
export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
