import Papa from "papaparse";
import { extractUtr, extractVpa } from "./extract";
import type { BankTxn } from "./types";

export interface ParsedStatement {
  txns: BankTxn[];
  skippedDebits: number;
  errors: string[];
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return mk(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) return mk(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -,]*(\d{2,4})/);
  if (m) {
    const mon = MONTHS.indexOf(m[2].toLowerCase());
    if (mon >= 0) return mk(m[3].length === 2 ? 2000 + +m[3] : +m[3], mon + 1, +m[1]);
  }
  return null;
}

function mk(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d));
}

export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,\s]|rs\.?|inr/gi, "").replace(/(cr|dr)$/i, "");
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned));
}

const find = (headers: string[], re: RegExp) => headers.find((h) => re.test(h.toLowerCase()));

/** Parses a bank statement CSV. Tolerates preamble lines above the header and common column names. */
export function parseBankCsv(text: string): ParsedStatement {
  const errors: string[] = [];
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => /narration|description|particulars|remarks/i.test(l) && /date/i.test(l));
  if (headerIdx < 0) {
    return { txns: [], skippedDebits: 0, errors: ["Could not find a header row with Date and Narration columns."] };
  }
  const parsed = Papa.parse<Record<string, string>>(lines.slice(headerIdx).join("\n"), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const dateCol = find(headers, /date/);
  const narrCol = find(headers, /narration|description|particulars|remarks/);
  const refCol = find(headers, /ref|chq|utr|cheque/);
  const creditCol = find(headers, /credit|deposit/);
  const debitCol = find(headers, /debit|withdraw/);
  const amountCol = find(headers, /^amount/);
  if (!dateCol || !narrCol || !(creditCol || amountCol)) {
    return { txns: [], skippedDebits: 0, errors: ["Missing a Date, Narration or Credit/Amount column."] };
  }

  const txns: BankTxn[] = [];
  let skippedDebits = 0;
  parsed.data.forEach((row, i) => {
    const line = headerIdx + i + 2;
    const date = parseDate(row[dateCol] ?? "");
    const narration = (row[narrCol] ?? "").trim();
    if (!date || !narration) {
      errors.push(`Row ${line}: missing or unreadable date/narration, skipped.`);
      return;
    }
    let credit = creditCol ? parseAmount(row[creditCol]) : null;
    const debit = debitCol ? parseAmount(row[debitCol]) : null;
    if (credit === null && amountCol) {
      const a = parseAmount(row[amountCol]);
      if (a !== null) credit = a;
    }
    if (!credit || credit <= 0) {
      if (debit && debit > 0) skippedDebits++;
      else errors.push(`Row ${line}: no credit amount, skipped.`);
      return;
    }
    const ref = refCol ? (row[refCol] ?? "").trim() : "";
    txns.push({
      date,
      amount: credit,
      narration,
      utr: extractUtr(`${ref} ${narration}`) ?? (ref || null),
      vpa: extractVpa(narration),
    });
  });
  return { txns, skippedDebits, errors };
}

/** Stable identity for a bank row, so importing the same statement twice never double-posts. */
export function rowKey(t: BankTxn): string {
  return [t.date.toISOString().slice(0, 10), t.amount, t.utr ?? "", t.narration.replace(/\s+/g, " ").trim().toLowerCase()].join("|");
}
