import { cookies } from "next/headers";

export const LANGS = ["en", "mr", "hi"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { en: "English", mr: "मराठी", hi: "हिन्दी" };

const DICT = {
  en: {
    "nav.home": "Home", "nav.bills": "Bills", "nav.complaints": "Complaints", "nav.more": "More",
    greeting: "Hello", "dues.title": "Maintenance due", "dues.allPaid": "All paid", "dues.dueBy": "Due by",
    "dues.overdue": "overdue", "dues.pay": "Pay now", "dues.late": "includes late fee", "dues.credit": "advance credit",
    "complaints.open": "Open complaints", "complaints.none": "No open complaints", "complaints.raise": "Raise a complaint",
    notices: "Notices", seeAll: "See all", "dues.upToDate": "You are up to date. Thank you.",
  },
  mr: {
    "nav.home": "मुख्यपृष्ठ", "nav.bills": "बिले", "nav.complaints": "तक्रारी", "nav.more": "अधिक",
    greeting: "नमस्कार", "dues.title": "देय देखभाल शुल्क", "dues.allPaid": "सर्व भरले", "dues.dueBy": "शेवटची तारीख",
    "dues.overdue": "थकीत", "dues.pay": "आता भरा", "dues.late": "विलंब शुल्क समाविष्ट", "dues.credit": "आगाऊ जमा",
    "complaints.open": "खुल्या तक्रारी", "complaints.none": "कोणतीही खुली तक्रार नाही", "complaints.raise": "तक्रार नोंदवा",
    notices: "सूचना", seeAll: "सर्व पहा", "dues.upToDate": "तुमचे सर्व शुल्क भरलेले आहे. धन्यवाद.",
  },
  hi: {
    "nav.home": "होम", "nav.bills": "बिल", "nav.complaints": "शिकायतें", "nav.more": "और",
    greeting: "नमस्ते", "dues.title": "देय रखरखाव शुल्क", "dues.allPaid": "सब चुकता", "dues.dueBy": "अंतिम तिथि",
    "dues.overdue": "बकाया", "dues.pay": "अभी भुगतान करें", "dues.late": "विलंब शुल्क सहित", "dues.credit": "अग्रिम जमा",
    "complaints.open": "खुली शिकायतें", "complaints.none": "कोई खुली शिकायत नहीं", "complaints.raise": "शिकायत दर्ज करें",
    notices: "सूचनाएं", seeAll: "सभी देखें", "dues.upToDate": "आपका सारा शुल्क चुकता है। धन्यवाद।",
  },
} as const;

export type Key = keyof (typeof DICT)["en"];
export type T = (key: Key) => string;

export function translator(lang: Lang): T {
  return (key) => DICT[lang][key] ?? DICT.en[key];
}

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return (LANGS as readonly string[]).includes(v ?? "") ? (v as Lang) : "en";
}
