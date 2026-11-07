import { describe, expect, it } from "vitest";
import { allocatePayment, computeAccount, type BillRow, type LedgerRow } from "@/lib/account";

const d = (s: string) => new Date(s + "T00:00:00Z");
const bill = (period: string, principal = 6370): BillRow => ({ period, principal, dueDate: d(`${period}-10`) });
const billEntry = (period: string, amount = 6370): LedgerRow => ({ type: "BILL", amount, period, createdAt: d(`${period}-01`) });

describe("computeAccount", () => {
  it("shows an unpaid bill before its due date as DUE with no late fee", () => {
    const a = computeAccount([bill("2026-11")], [billEntry("2026-11")], d("2026-11-07"));
    expect(a.totalDue).toBe(6370);
    expect(a.periods[0]).toMatchObject({ status: "DUE", daysOverdue: 0, lateFeeOutstanding: 0 });
  });

  it("accrues late fee on an overdue bill", () => {
    const a = computeAccount([bill("2026-10")], [billEntry("2026-10")], d("2026-11-26"));
    expect(a.periods[0].status).toBe("OVERDUE");
    expect(a.periods[0].daysOverdue).toBe(47);
    expect(a.periods[0].lateFeeOutstanding).toBeGreaterThan(0);
    expect(a.totalDue).toBe(6370 + a.periods[0].lateFeeOutstanding);
    expect(a.overdueDays).toBe(47);
  });

  it("marks a fully paid period as PAID", () => {
    const ledger: LedgerRow[] = [billEntry("2026-10"), { type: "PAYMENT", amount: -6370, period: "2026-10", createdAt: d("2026-10-05") }];
    const a = computeAccount([bill("2026-10")], ledger, d("2026-11-07"));
    expect(a.totalDue).toBe(0);
    expect(a.periods[0].status).toBe("PAID");
  });
});

describe("allocatePayment", () => {
  it("settles the oldest bill first, late fee before principal", () => {
    const bills = [bill("2026-09"), bill("2026-10")];
    const ledger = [billEntry("2026-09"), billEntry("2026-10")];
    const acct = computeAccount(bills, ledger, d("2026-11-07"));
    const fee = acct.periods[0].lateFeeOutstanding;
    expect(fee).toBeGreaterThan(0);

    const alloc = allocatePayment(acct, 6370);
    // Sep late fee is written to the ledger, then the payment covers fee + part of Sep principal.
    expect(alloc.entries[0]).toMatchObject({ type: "LATE_FEE", period: "2026-09", amount: fee });
    expect(alloc.applied).toHaveLength(1);
    expect(alloc.applied[0]).toMatchObject({ period: "2026-09", toLateFee: fee, toPrincipal: 6370 - fee });
    expect(alloc.creditAdded).toBe(0);
  });

  it("keeps a partial payment against the right bill and leaves the rest due", () => {
    const bills = [bill("2026-10", 10660)];
    const ledger = [billEntry("2026-10", 10660)];
    const acct = computeAccount(bills, ledger, d("2026-10-28"));
    const alloc = allocatePayment(acct, 5000);
    const after = computeAccount(
      bills,
      [...ledger, ...alloc.entries.map((e) => ({ ...e, createdAt: d("2026-10-28") }))],
      d("2026-10-28"),
    );
    expect(after.periods[0].paid).toBe(5000);
    expect(after.totalDue).toBe(acct.totalDue - 5000);
  });

  it("turns an overpayment into advance credit and uses it next time", () => {
    const bills = [bill("2026-11")];
    const ledger = [billEntry("2026-11")];
    const acct = computeAccount(bills, ledger, d("2026-11-05"));
    const alloc = allocatePayment(acct, 10000);
    expect(alloc.creditAdded).toBe(3630);

    const ledger2 = [...ledger, ...alloc.entries.map((e) => ({ ...e, createdAt: d("2026-11-05") }))];
    const acct2 = computeAccount(bills, ledger2, d("2026-11-06"));
    expect(acct2.totalDue).toBe(0);
    expect(acct2.credit).toBe(3630);

    // December bill arrives: credit offsets it, and paying the remainder consumes the credit.
    const bills3 = [...bills, bill("2026-12")];
    const ledger3 = [...ledger2, billEntry("2026-12")];
    const acct3 = computeAccount(bills3, ledger3, d("2026-12-02"));
    expect(acct3.totalDue).toBe(6370 - 3630);
    const alloc3 = allocatePayment(acct3, acct3.totalDue);
    const ledger4 = [...ledger3, ...alloc3.entries.map((e) => ({ ...e, createdAt: d("2026-12-02") }))];
    const acct4 = computeAccount(bills3, ledger4, d("2026-12-02"));
    expect(acct4.totalDue).toBe(0);
    expect(acct4.credit).toBe(0);
  });

  it("ledger balance reconciles with the derived account after every payment", () => {
    const bills = [bill("2026-09"), bill("2026-10"), bill("2026-11")];
    let ledger: LedgerRow[] = bills.map((b) => billEntry(b.period));
    const now = d("2026-11-20");
    for (const amount of [3000, 5000, 20000]) {
      const acct = computeAccount(bills, ledger, now);
      const alloc = allocatePayment(acct, amount);
      ledger = [...ledger, ...alloc.entries.map((e) => ({ ...e, createdAt: now }))];
      const after = computeAccount(bills, ledger, now);
      const balance = ledger.reduce((s, l) => s + l.amount, 0);
      const unposted = after.periods.reduce((s, p) => s + p.lateFeeUnposted, 0);
      // Ledger balance = what is owed, minus credit, minus interest accrued but not yet written down.
      expect(balance + unposted).toBe(after.totalOutstanding - after.credit);
    }
  });
});
