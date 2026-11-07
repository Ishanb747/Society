// Pulls flat references, UTRs and UPI IDs out of free-text bank narrations.

const pad = (v: string | number, n: number) => String(v).padStart(n, "0");

/**
 * Finds things that look like a flat reference and normalises them to "T12-0408".
 * Handles: T12-0408, T120408, T12/408, TWR 12 FLAT 408, TOWER12 FLT 0408, 12-0408.
 * Matches are only candidates: the scorer keeps the ones that exist in the society.
 */
export function extractFlatRefs(narration: string): string[] {
  const text = narration.toUpperCase();
  const found = new Set<string>();

  const prefixed = /\bT(?:WR|OWER)?\s*[-.:]?\s*(\d{1,2})\s*[-/ .,]?\s*(?:FLAT|FLT|F|NO|#)?\s*[-/ .:]?\s*(\d{3,4})\b/g;
  for (const m of text.matchAll(prefixed)) found.add(`T${pad(m[1], 2)}-${pad(m[2], 4)}`);

  const bare = /(?<![\d/])(\d{1,2})\s*[-/]\s*(\d{3,4})(?![\d/])/g;
  for (const m of text.matchAll(bare)) found.add(`T${pad(m[1], 2)}-${pad(m[2], 4)}`);

  return [...found];
}

export function extractVpa(narration: string): string | null {
  const m = narration.toLowerCase().match(/[a-z0-9._-]{2,}@[a-z][a-z0-9]{1,}(?![a-z0-9.])/);
  return m ? m[0] : null;
}

/** UPI reference numbers are 12 digits; NEFT/IMPS references are letters followed by digits. */
export function extractUtr(narration: string): string | null {
  const upi = narration.match(/(?<!\d)\d{12}(?!\d)/);
  if (upi) return upi[0];
  const neft = narration.toUpperCase().match(/\b[A-Z]{4}[A-Z0-9]?\d{9,}\b/);
  return neft ? neft[0] : null;
}
