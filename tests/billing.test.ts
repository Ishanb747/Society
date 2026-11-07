import { describe, expect, it } from "vitest";
import { dueDateFor, daysOverdue, formatINR, lateFee, monthlyBill } from "@/lib/billing";

describe("monthlyBill", () => {
  // Sample flats from the client brief
  it.each([
    [1150, 7475],
    [980, 6370],
    [1640, 10660],
  ])("%i sq ft -> %i", (area, bill) => {
    expect(monthlyBill(area)).toBe(bill);
  });
});

describe("daysOverdue", () => {
  it("is 0 on or before the due date", () => {
    expect(daysOverdue(new Date("2026-11-10"), new Date("2026-11-10"))).toBe(0);
    expect(daysOverdue(new Date("2026-11-10"), new Date("2026-11-03"))).toBe(0);
  });
  it("counts whole days after the due date", () => {
    expect(daysOverdue(new Date("2026-10-10"), new Date("2026-11-26"))).toBe(47);
  });
});

describe("lateFee", () => {
  it("is zero when nothing is overdue or nothing is unpaid", () => {
    expect(lateFee(6370, 0)).toBe(0);
    expect(lateFee(0, 30)).toBe(0);
  });
  it("accrues simple interest at 21% a year", () => {
    // 6370 * 0.21 * 47 / 365 = 172.2...
    expect(lateFee(6370, 47)).toBe(172);
  });
});

describe("helpers", () => {
  it("builds the due date for a period", () => {
    expect(dueDateFor("2026-11").toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });
  it("formats rupees with Indian grouping", () => {
    expect(formatINR(1234567)).toContain("12,34,567");
  });
});
