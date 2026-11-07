import type { CategoryKey, UrgencyKey } from "@/lib/constants";

// Offline fallback classifier. Used when there is no API key, the AI call fails or times out,
// or the AI is not confident enough.
const KEYWORDS: Record<Exclude<CategoryKey, "OTHER">, RegExp[]> = {
  PLUMBING: [/\bleak/i, /\btap\b/i, /\bpipe/i, /\bwater\b/i, /\bdrain/i, /\bflush/i, /\bseepage/i, /\bgeyser/i, /\bsink\b/i, /\bwash ?basin/i, /पाणी|पानी|नळ|नल|गळ/],
  ELECTRICAL: [/\blight/i, /\bpower\b/i, /\bswitch/i, /\bfuse/i, /\bwiring/i, /\bmcb\b/i, /\belectric/i, /\bbulb/i, /\binverter/i, /वीज|बिजली|लाईट|लाइट/],
  LIFT: [/\blift/i, /\belevator/i, /लिफ्ट/],
  SECURITY: [/\bguard/i, /\bgate\b/i, /\bstranger/i, /\btheft|\bstolen|\bthief/i, /\bcctv/i, /\bintruder/i, /\bsecurity/i, /सुरक्षा|चोर/],
  HOUSEKEEPING: [/\bgarbage/i, /\bdustbin/i, /\bcleaning/i, /\bsweep/i, /\btrash/i, /\bdirty/i, /\bwaste/i, /कचरा|सफाई|स्वच्छता/],
  PEST: [/\bcockroach/i, /\bmosquito/i, /\brats?\b/i, /\btermite/i, /\bants\b/i, /\bpest/i, /\bbedbug/i, /\bsnake/i, /झुरळ|कीड|मच्छर|चूहा/],
  PARKING: [/\bparking/i, /\bparked/i, /\bvehicle/i, /\bbike\b/i, /\bcar\b/i, /पार्किंग/],
  NOISE: [/\bnoise/i, /\bnoisy/i, /\bloud/i, /\bmusic/i, /\bparty/i, /\bdrilling/i, /\bconstruction/i, /आवाज|गोंगाट|शोर/],
};

const HIGH = /\burgent|emergency|immediately|no water|no power|power cut|overflow|not working since|since (?:yesterday|morning|last night)|\bmany\b|\ball\b|तातडीचे|जरूरी|तुरंत/i;
const LOW = /\bsuggest|\brequest\b|\bplease (?:add|install|consider)|\bwould like\b|\bminor\b|\bpaint|\bfaded/i;

export interface KeywordResult {
  category: CategoryKey;
  urgency: UrgencyKey;
  confidence: number;
}

export function keywordClassify(text: string): KeywordResult {
  let best: CategoryKey = "OTHER";
  let bestHits = 0;
  for (const [cat, patterns] of Object.entries(KEYWORDS) as [Exclude<CategoryKey, "OTHER">, RegExp[]][]) {
    const hits = patterns.filter((p) => p.test(text)).length;
    if (hits > bestHits) {
      best = cat;
      bestHits = hits;
    }
  }
  const urgency: UrgencyKey = HIGH.test(text) ? "HIGH" : LOW.test(text) ? "LOW" : "MEDIUM";
  const confidence = bestHits === 0 ? 0.2 : Math.min(0.85, 0.5 + 0.12 * bestHits);
  return { category: best, urgency, confidence };
}
