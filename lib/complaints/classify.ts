import type { CategoryKey, UrgencyKey } from "@/lib/constants";
import { aiClassify, type AiResult } from "./ai";
import { keywordClassify } from "./keywords";
import { detectSafety } from "./safety";

export type ClassifiedBy = "AI" | "RULE" | "FALLBACK";

export interface Classification {
  category: CategoryKey;
  urgency: UrgencyKey;
  classifiedBy: ClassifiedBy;
  needsReview: boolean;
  safetyEscalated: boolean;
  safetyTerms: string[];
  ai: AiResult | null;
  note: string;
}

export const AI_MIN_CONFIDENCE = 0.6;
const KEYWORD_TRUSTED = 0.7;

/**
 * Order of authority:
 *  1. Safety rule: always CRITICAL + escalated, whatever the AI says.
 *  2. AI, if it answered with enough confidence.
 *  3. Keyword fallback (no key, error, timeout or low confidence), flagged for review when weak.
 */
export async function classifyComplaint(
  text: string,
  deps: { ai?: (t: string) => Promise<AiResult | null> } = {},
): Promise<Classification> {
  const safetyTerms = detectSafety(text);
  const ai = await (deps.ai ?? aiClassify)(text).catch(() => null);
  const kw = keywordClassify(text);
  const aiOk = !!ai && ai.confidence >= AI_MIN_CONFIDENCE;

  const category: CategoryKey = aiOk ? ai.category : kw.category;
  let urgency: UrgencyKey = aiOk ? ai.urgency : kw.urgency;
  let classifiedBy: ClassifiedBy = aiOk ? "AI" : "FALLBACK";
  let needsReview = aiOk ? false : kw.confidence < KEYWORD_TRUSTED;
  let note = aiOk
    ? `AI: ${ai.category} / ${ai.urgency} (${Math.round(ai.confidence * 100)}% sure)`
    : ai
      ? `AI was unsure (${Math.round(ai.confidence * 100)}%); used keyword rules`
      : "AI unavailable; used keyword rules";

  const safetyEscalated = safetyTerms.length > 0;
  if (safetyEscalated) {
    urgency = "CRITICAL";
    classifiedBy = "RULE";
    needsReview = false;
    note = `Safety rule: "${safetyTerms.join(", ")}". Duty manager notified`;
  }
  return { category, urgency, classifiedBy, needsReview, safetyEscalated, safetyTerms, ai, note };
}
