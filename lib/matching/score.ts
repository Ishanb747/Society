import { extractFlatRefs, extractVpa } from "./extract";
import type { BankTxn, Candidate, FlatSnapshot, MatchResult } from "./types";

// Signal weights. Auto-posting needs a strong identity signal (flat ID or registered UPI ID)
// plus a matching amount, so a score of AUTO_THRESHOLD is only reachable with both.
export const SCORE = {
  flatId: 60,
  knownUpi: 60,
  amountEqualsDue: 30,
  amountEqualsBill: 25,
  partial: 10,
  surname: 10,
} as const;

export const AUTO_THRESHOLD = 90;
export const REVIEW_THRESHOLD = 40;
// If the runner-up is within this many points of the winner the row is ambiguous.
export const AMBIGUITY_GAP = 15;

export function matchTxn(txn: BankTxn, flats: FlatSnapshot[]): MatchResult {
  const byId = new Map(flats.map((f) => [f.id, f]));
  const narration = txn.narration;
  const upper = narration.toUpperCase();
  const vpa = txn.vpa ?? extractVpa(narration);
  const cands = new Map<string, Candidate>();
  const strong = new Set<string>(); // flats with an identity signal (flat ID or UPI)

  const add = (flatId: string, points: number, reason: string) => {
    const c = cands.get(flatId) ?? { flatId, score: 0, reasons: [] };
    c.score += points;
    c.reasons.push(points ? `${reason} +${points}` : reason);
    cands.set(flatId, c);
  };

  for (const ref of extractFlatRefs(narration)) {
    if (byId.has(ref)) {
      add(ref, SCORE.flatId, `Flat ID ${ref} in reference`);
      strong.add(ref);
    }
  }
  if (vpa) {
    for (const f of flats) {
      if (f.upiIds.includes(vpa)) {
        add(f.id, SCORE.knownUpi, `UPI ID ${vpa} registered to flat`);
        strong.add(f.id);
      }
    }
  }
  for (const f of flats) {
    const hit = f.surnames.find((s) => s.length >= 4 && upper.includes(s.toUpperCase()));
    if (hit) add(f.id, SCORE.surname, `Payer name matches "${hit}"`);
  }

  // Amount signals apply to flats we already have a reason to consider.
  for (const c of cands.values()) {
    const f = byId.get(c.flatId)!;
    if (f.outstanding <= 0) {
      add(c.flatId, 0, "Flat has no dues; payment would become advance credit");
    } else if (txn.amount === f.outstanding) {
      add(c.flatId, SCORE.amountEqualsDue, "Amount equals total due");
    } else if (txn.amount === f.billAmount) {
      add(c.flatId, SCORE.amountEqualsBill, "Amount equals one month's bill");
    } else if (txn.amount < f.outstanding) {
      add(c.flatId, SCORE.partial, `Partial payment: ₹${f.outstanding - txn.amount} would remain due`);
    } else {
      add(c.flatId, 0, `Amount is ₹${txn.amount - f.outstanding} more than total due`);
    }
  }

  const ranked = [...cands.values()].sort((a, b) => b.score - a.score || a.flatId.localeCompare(b.flatId));
  const top = ranked[0];
  if (!top) {
    return { status: "UNMATCHED", flatId: null, score: 0, reasons: ["No flat ID, registered UPI ID or payer name found"], candidates: [] };
  }

  const second = ranked[1];
  const ambiguous = !!second && top.score - second.score < AMBIGUITY_GAP;
  const reasons = [...top.reasons];
  if (ambiguous) reasons.push(`Ambiguous: ${second.flatId} scores almost as high (${second.score})`);

  let status: MatchResult["status"];
  if (top.score >= AUTO_THRESHOLD && strong.has(top.flatId) && !ambiguous) status = "AUTO_POSTED";
  else if (top.score >= REVIEW_THRESHOLD) status = "REVIEW";
  else status = "UNMATCHED";

  return {
    status,
    flatId: status === "UNMATCHED" ? null : top.flatId,
    score: top.score,
    reasons,
    candidates: ranked.slice(0, 3),
  };
}
