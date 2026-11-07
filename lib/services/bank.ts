import { createHash } from "node:crypto";
import { computeAccount } from "@/lib/account";
import { db } from "@/lib/db";
import { parseBankCsv, rowKey } from "@/lib/matching/parse";
import { matchTxn } from "@/lib/matching/score";
import type { BankTxn, FlatSnapshot } from "@/lib/matching/types";
import { monthlyBill } from "@/lib/billing";
import { postPayment, loadAccount } from "./ledger";

function methodFor(txn: Pick<BankTxn, "narration" | "vpa">): "UPI" | "NEFT" | "CHEQUE" {
  const n = txn.narration.toUpperCase();
  if (txn.vpa || n.startsWith("UPI")) return "UPI";
  if (/\bCHQ|CHEQUE\b/.test(n)) return "CHEQUE";
  return "NEFT";
}

async function loadSnapshots(now: Date): Promise<Map<string, FlatSnapshot>> {
  const [flats, bills, ledger, upi] = await Promise.all([
    db.flat.findMany({ include: { memberships: { include: { user: true } } } }),
    db.bill.findMany(),
    db.ledgerEntry.findMany(),
    db.knownUpiId.findMany(),
  ]);
  const billsBy = Map.groupBy(bills, (b) => b.flatId);
  const ledgerBy = Map.groupBy(ledger, (l) => l.flatId);
  const upiBy = Map.groupBy(upi, (u) => u.flatId);
  return new Map(
    flats.map((f) => {
      const acct = computeAccount(billsBy.get(f.id) ?? [], ledgerBy.get(f.id) ?? [], now);
      return [
        f.id,
        {
          id: f.id,
          outstanding: acct.totalDue,
          billAmount: monthlyBill(f.areaSqft),
          upiIds: (upiBy.get(f.id) ?? []).map((u) => u.vpa.toLowerCase()),
          surnames: f.memberships.map((m) => m.user.name.replace(/\(.*\)/, "").trim().split(/\s+/).pop() ?? ""),
        },
      ];
    }),
  );
}

export interface ImportSummary {
  importId: string | null;
  fileName: string;
  total: number;
  autoPosted: number;
  review: number;
  unmatched: number;
  duplicatesSkipped: number;
  debitsSkipped: number;
  errors: string[];
  alreadyImported: boolean;
}

export async function importStatement(fileName: string, text: string, uploadedBy: string): Promise<ImportSummary> {
  const base: ImportSummary = {
    importId: null, fileName, total: 0, autoPosted: 0, review: 0, unmatched: 0,
    duplicatesSkipped: 0, debitsSkipped: 0, errors: [], alreadyImported: false,
  };
  const parsed = parseBankCsv(text);
  base.errors = parsed.errors;
  base.debitsSkipped = parsed.skippedDebits;
  if (!parsed.txns.length) return base;

  const fileHash = createHash("sha256").update(text).digest("hex");
  const prior = await db.bankImport.findUnique({ where: { fileHash } });
  if (prior) return { ...base, importId: prior.id, alreadyImported: true };

  const now = new Date();
  const snapshots = await loadSnapshots(now);
  const imp = await db.bankImport.create({ data: { fileName, fileHash, uploadedBy, rowCount: parsed.txns.length } });
  base.importId = imp.id;

  const txns = [...parsed.txns].sort((a, b) => a.date.getTime() - b.date.getTime());
  const keys = txns.map((t) => createHash("sha256").update(rowKey(t)).digest("hex"));
  const known = new Set((await db.bankRow.findMany({ where: { rowHash: { in: keys } }, select: { rowHash: true } })).map((r) => r.rowHash));
  const seen = new Set<string>();

  for (const [i, txn] of txns.entries()) {
    const rowHash = keys[i];
    if (known.has(rowHash) || seen.has(rowHash)) {
      base.duplicatesSkipped++;
      continue;
    }
    seen.add(rowHash);
    base.total++;

    const m = matchTxn(txn, [...snapshots.values()]);
    const common = {
      importId: imp.id, rowHash, txnDate: txn.date, amount: txn.amount, narration: txn.narration,
      utr: txn.utr, vpa: txn.vpa, score: m.score, reasons: m.reasons, candidates: m.candidates,
    };
    if (m.status === "AUTO_POSTED" && m.flatId) {
      const { payment } = await postPayment({
        flatId: m.flatId, amount: txn.amount, method: methodFor(txn), source: "BANK", utr: txn.utr, paidAt: txn.date,
      });
      const acct = await loadAccount(m.flatId, now);
      snapshots.get(m.flatId)!.outstanding = acct.totalDue;
      await db.bankRow.create({
        data: { ...common, status: "AUTO_POSTED", suggestedFlatId: m.flatId, matchedFlatId: m.flatId, paymentId: payment.id, resolvedBy: "system", resolvedAt: now },
      });
      base.autoPosted++;
    } else {
      await db.bankRow.create({ data: { ...common, status: m.status, suggestedFlatId: m.flatId } });
      if (m.status === "REVIEW") base.review++;
      else base.unmatched++;
    }
  }
  return base;
}

export type ResolveResult = { ok: true } | { ok: false; error: string };

export async function confirmRow(rowId: string, flatId: string, staffId: string): Promise<ResolveResult> {
  const row = await db.bankRow.findUnique({ where: { id: rowId } });
  if (!row) return { ok: false, error: "Row not found" };
  const flat = await db.flat.findUnique({ where: { id: flatId } });
  if (!flat) return { ok: false, error: `No flat ${flatId}` };
  // Claim the row first so a double click can never post the money twice.
  const claimed = await db.bankRow.updateMany({
    where: { id: rowId, status: { in: ["REVIEW", "UNMATCHED"] } },
    data: { status: "POSTED", matchedFlatId: flatId, resolvedBy: staffId, resolvedAt: new Date() },
  });
  if (claimed.count === 0) return { ok: false, error: "This row was already resolved" };
  try {
    const { payment } = await postPayment({
      flatId, amount: row.amount, method: methodFor(row), source: "BANK", utr: row.utr, paidAt: row.txnDate,
    });
    await db.bankRow.update({ where: { id: rowId }, data: { paymentId: payment.id } });
    return { ok: true };
  } catch {
    await db.bankRow.update({ where: { id: rowId }, data: { status: row.status, matchedFlatId: null, resolvedBy: null, resolvedAt: null } });
    return { ok: false, error: "Could not post the payment. Nothing was changed." };
  }
}

export async function ignoreRow(rowId: string, staffId: string): Promise<ResolveResult> {
  const r = await db.bankRow.updateMany({
    where: { id: rowId, status: { in: ["REVIEW", "UNMATCHED"] } },
    data: { status: "IGNORED", resolvedBy: staffId, resolvedAt: new Date() },
  });
  return r.count ? { ok: true } : { ok: false, error: "This row was already resolved" };
}
