// Safety words always escalate to the duty manager, whatever the AI says.
// Deliberately broad: a false alarm costs a phone call, a miss can cost a life.

const RULES: { term: string; re: RegExp }[] = [
  { term: "fire", re: /\bfire\b|\bflames?\b|\bburning\b|\bburnt\b/i },
  { term: "smoke", re: /\bsmoke\b|\bsmoking\b/i },
  { term: "gas", re: /\bgas\b|\blpg\b/i },
  { term: "short circuit", re: /short[\s-]?circuit|\bsparks?\b|\bsparking\b/i },
  { term: "shock", re: /\bshock(?:ed|ing)?\b|\belectrocut/i },
  { term: "lift stuck", re: /(?:lift|elevator)[^.\n]{0,40}(?:stuck|trapped|stopped between|not moving)|(?:stuck|trapped)[^.\n]{0,40}(?:lift|elevator)/i },
  { term: "trapped", re: /\btrapped\b/i },
  { term: "collapse", re: /\bcollaps(?:e|ed|ing)\b|\bceiling (?:fell|falling)\b/i },
  { term: "flooding", re: /\bflood(?:ed|ing)?\b/i },
  // Marathi / Hindi
  { term: "आग", re: /आग|जळ/ },
  { term: "धूर", re: /धूर|धुआं|धुआँ/ },
  { term: "गॅस", re: /गॅस|गैस/ },
  { term: "शॉक", re: /शॉक|करंट|करण्ट/ },
  { term: "लिफ्ट अडकली", re: /लिफ्ट[^.\n]{0,30}(?:अडकल|फंस|अटक)/ },
];

export function detectSafety(text: string): string[] {
  return RULES.filter((r) => r.re.test(text)).map((r) => r.term);
}
