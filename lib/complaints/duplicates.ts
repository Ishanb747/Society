import type { CategoryKey } from "@/lib/constants";

const STOP = new Set(
  "the a an is are was were in on at of to for and or my our not no it this that there with has have had been since from by please near flat tower".split(" "),
);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export interface DupCandidate {
  id: string;
  category: CategoryKey;
  text: string;
  tower: number;
  createdAt: Date;
  parentId: string | null;
}

export const DUP_WINDOW_MS = 24 * 3600_000;
export const DUP_SIMILARITY = 0.4;

/**
 * Finds an existing complaint this one is probably a duplicate of. Same tower, same category,
 * within 24 hours, and similar wording. A lift problem in the same tower always counts, because
 * "ten flats reporting the same lift" rarely use the same words. Returns the root complaint id.
 * Duplicates are linked, never closed.
 */
export function findDuplicateParent(
  incoming: { category: CategoryKey; text: string; tower: number; createdAt: Date },
  existing: DupCandidate[],
): string | null {
  const matches = existing
    .filter((c) => c.tower === incoming.tower && c.category === incoming.category)
    .filter((c) => incoming.createdAt.getTime() - c.createdAt.getTime() <= DUP_WINDOW_MS && c.createdAt <= incoming.createdAt)
    .filter((c) => incoming.category === "LIFT" || similarity(incoming.text, c.text) >= DUP_SIMILARITY)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const first = matches[0];
  return first ? (first.parentId ?? first.id) : null;
}
