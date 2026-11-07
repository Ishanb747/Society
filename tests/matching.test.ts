import { describe, expect, it } from "vitest";
import { extractFlatRefs, extractUtr, extractVpa } from "@/lib/matching/extract";
import { parseBankCsv, parseDate, rowKey } from "@/lib/matching/parse";
import { matchTxn } from "@/lib/matching/score";
import type { BankTxn, FlatSnapshot } from "@/lib/matching/types";

const flat = (id: string, bill: number, extra: Partial<FlatSnapshot> = {}): FlatSnapshot => ({
  id,
  outstanding: bill,
  billAmount: bill,
  upiIds: [],
  surnames: [],
  ...extra,
});

const FLATS: FlatSnapshot[] = [
  flat("T03-0204", 7475, { upiIds: ["rahul.sharma@okhdfcbank"], surnames: ["Sharma"] }),
  flat("T14-0601", 7475, { surnames: ["Kulkarni"] }),
  flat("T14-0602", 7475, { surnames: ["Kulkarni"] }),
  flat("T09-1102", 8580),
  flat("T25-1204", 8580),
  flat("T07-1203", 7475, { outstanding: 0 }),
  flat("T11-0903", 6370),
  flat("T02-1503", 9230, { surnames: ["Gupta"] }),
];

const txn = (narration: string, amount: number): BankTxn => ({
  date: new Date("2026-11-03"),
  amount,
  narration,
  utr: extractUtr(narration),
  vpa: extractVpa(narration),
});

describe("extractFlatRefs", () => {
  it.each([
    ["UPI/412345678901/T03-0204 MAINT", "T03-0204"],
    ["NEFT T030204 maintenance", "T03-0204"],
    ["maint 3/204", "T03-0204"],
    ["TWR 3 FLAT 204 NOVEMBER", "T03-0204"],
    ["TOWER12 FLT 0408", "T12-0408"],
    ["12-0408 bill", "T12-0408"],
  ])("%s -> %s", (narration, expected) => {
    expect(extractFlatRefs(narration)).toContain(expected);
  });
  it("does not read a date as a flat", () => {
    expect(extractFlatRefs("PAID ON 07/11/2026")).not.toContain("T07-0011");
  });
});

describe("extract utr and vpa", () => {
  it("finds a 12 digit UPI reference", () => expect(extractUtr("UPI/412345678901/abc")).toBe("412345678901"));
  it("finds a UPI id", () => expect(extractVpa("UPI/x/rahul.sharma@okhdfcbank/Maint")).toBe("rahul.sharma@okhdfcbank"));
  it("does not mistake an email for a UPI id", () => expect(extractVpa("mail me at a@b.com")).toBeNull());
});

describe("matchTxn", () => {
  it("auto-posts: flat ID in reference and exact amount", () => {
    const r = matchTxn(txn("UPI/412345678901/T03-0204 MAINT NOV", 7475), FLATS);
    expect(r).toMatchObject({ status: "AUTO_POSTED", flatId: "T03-0204" });
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("auto-posts: registered UPI id and exact amount, no flat ID", () => {
    const r = matchTxn(txn("UPI/412345678902/rahul.sharma@okhdfcbank/Maintenance", 7475), FLATS);
    expect(r).toMatchObject({ status: "AUTO_POSTED", flatId: "T03-0204" });
  });

  it("auto-posts despite a mangled flat ID format", () => {
    const r = matchTxn(txn("IMPS TWR 9 FLAT 1102 MAINT", 8580), FLATS);
    expect(r).toMatchObject({ status: "AUTO_POSTED", flatId: "T09-1102" });
  });

  it("sends a partial payment to review, never auto-posts", () => {
    const r = matchTxn(txn("UPI/412345678903/T11-0903 maint", 3000), FLATS);
    expect(r.status).toBe("REVIEW");
    expect(r.flatId).toBe("T11-0903");
    expect(r.reasons.join(" ")).toMatch(/Partial payment/);
  });

  it("sends an overpayment to review", () => {
    const r = matchTxn(txn("T11-0903 maintenance", 10000), FLATS);
    expect(r.status).toBe("REVIEW");
    expect(r.reasons.join(" ")).toMatch(/more than total due/);
  });

  it("sends a payment for a flat with no dues to review", () => {
    const r = matchTxn(txn("UPI/412345678904/T07-1203 maint", 7475), FLATS);
    expect(r.status).toBe("REVIEW");
    expect(r.reasons.join(" ")).toMatch(/no dues/i);
  });

  it("flags two flats named in one reference as ambiguous", () => {
    const r = matchTxn(txn("T14-0601 and T14-0602 maint", 7475), FLATS);
    expect(r.status).toBe("REVIEW");
    expect(r.reasons.join(" ")).toMatch(/Ambiguous/);
  });

  it("never matches on amount alone", () => {
    const r = matchTxn(txn("NEFT-ABC123456789-UNKNOWN PAYER", 8580), FLATS);
    expect(r.status).toBe("UNMATCHED");
    expect(r.flatId).toBeNull();
  });

  it("suggests a flat from the payer name plus amount, for review", () => {
    const r = matchTxn(txn("NEFT MR ASHOK GUPTA", 9230), FLATS);
    expect(r.status).toBe("REVIEW");
    expect(r.flatId).toBe("T02-1503");
  });

  it("ignores a flat ID that does not exist", () => {
    const r = matchTxn(txn("T03-0299 maint", 7475), FLATS);
    expect(r.status).toBe("UNMATCHED");
  });

  it("leaves bank interest and refunds unmatched", () => {
    expect(matchTxn(txn("INT.PD:01-08-2026 TO 31-10-2026", 412), FLATS).status).toBe("UNMATCHED");
  });
});

describe("parseBankCsv", () => {
  const csv = [
    "HDFC Bank Statement,,,,",
    "Account: XXXX1234,,,,",
    "Date,Narration,Chq/Ref No,Withdrawal Amt,Deposit Amt",
    "03/11/2026,UPI/412345678901/T03-0204 MAINT,412345678901,,\"7,475.00\"",
    "04/11/2026,ELECTRICITY BILL,REF1,5000.00,",
    "05/11/2026,INT.PD,,,412.00",
    "bad row,,,,",
  ].join("\n");

  it("skips preamble, debits and bad rows, and reads Indian-formatted amounts", () => {
    const r = parseBankCsv(csv);
    expect(r.txns).toHaveLength(2);
    expect(r.txns[0]).toMatchObject({ amount: 7475, utr: "412345678901" });
    expect(r.skippedDebits).toBe(1);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("reports a file that is not a statement", () => {
    expect(parseBankCsv("a,b\n1,2").errors[0]).toMatch(/header/);
  });

  it("parses common date formats", () => {
    expect(parseDate("03/11/2026")?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(parseDate("2026-11-03")?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(parseDate("03 Nov 2026")?.toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(parseDate("nope")).toBeNull();
  });

  it("gives the same key to the same row, so a re-import is idempotent", () => {
    const [a] = parseBankCsv(csv).txns;
    const [b] = parseBankCsv(csv).txns;
    expect(rowKey(a)).toBe(rowKey(b));
  });
});
