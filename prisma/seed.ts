// Demo data. Deterministic (seeded RNG) and relative to "today", so the app always looks current.
// Runs on every deploy: it clears and recreates everything. Fake names and phone numbers only.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { allocatePayment, computeAccount, type BillRow, type LedgerRow } from "../lib/account";
import { dueDateFor, monthlyBill } from "../lib/billing";
import { CATEGORY_LABEL, RESPONSE_TARGET_MIN, type CategoryKey, type UrgencyKey } from "../lib/constants";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// ---------- helpers ----------
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261107);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p: number) => rnd() < p;
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

const NOW = new Date();
const periodKey = (y: number, m: number) => `${y}-${pad(m + 1)}`; // m is 0-based
const periods: { key: string; y: number; m: number }[] = [];
for (let k = 5; k >= 0; k--) {
  const d = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - k, 1));
  periods.push({ key: periodKey(d.getUTCFullYear(), d.getUTCMonth()), y: d.getUTCFullYear(), m: d.getUTCMonth() });
}
const CURRENT = periods[periods.length - 1].key;

async function insert<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>, size = 800) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

// ---------- people and flats ----------
const FIRST = ["Aarav", "Vihaan", "Aditya", "Rohan", "Kabir", "Siddharth", "Nikhil", "Yash", "Manish", "Pranav", "Sandeep", "Harsh", "Anjali", "Pooja", "Neha", "Kavya", "Ritu", "Sakshi", "Divya", "Shruti", "Madhuri", "Tanvi", "Rekha", "Smita", "Varun", "Gaurav", "Tejas", "Mihir", "Aditi", "Nandini"];
const LAST = ["Deshpande", "Pawar", "Gokhale", "Bhosale", "Jadhav", "Chavan", "Kale", "Naik", "Iyer", "Menon", "Banerjee", "Singh", "Verma", "Agarwal", "Thakur", "Shinde", "More", "Wagh", "Phadke", "Apte", "Dixit", "Rane", "Sawant", "Tilak", "Bapat", "Lele", "Oak", "Paranjape"];
const AREAS = [780, 980, 1150, 1320, 1420, 1640];

interface FlatSpec { id: string; area: number; members: { name: string; phone: string; kind: "OWNER" | "TENANT" | "FAMILY" }[]; upi?: string[]; special?: string }
const flats: FlatSpec[] = [];
const used = new Set<string>();
const flatId = (tower: number, floor: number, unit: number) => `T${pad(tower)}-${pad(floor)}${pad(unit)}`;
const own = (name: string, phone: string, kind: "OWNER" | "TENANT" | "FAMILY" = "OWNER") => ({ name, phone, kind });

function addFlat(f: FlatSpec) {
  used.add(f.id);
  flats.push(f);
}

// From the client brief
addFlat({ id: "T07-1203", area: 1150, members: [own("Neeraj Kulkarni", "9000000001")], special: "neeraj" });
addFlat({ id: "T12-0408", area: 980, members: [own("Swati Joshi", "9000000002", "TENANT")], special: "swati" });
addFlat({ id: "T21-1601", area: 1640, members: [own("Aamir Shaikh", "9000000003")], special: "aamir" });
// A resident who owns two flats (shows the flat switcher)
addFlat({ id: "T04-0302", area: 1320, members: [own("Meera Kapoor", "9000000004")] });
addFlat({ id: "T18-0905", area: 980, members: [own("Meera Kapoor", "9000000004")] });
// Flats the sample bank statement (public/samples/bank-statement.csv) refers to: unpaid this month, no arrears
const BANK_DEMO: [string, number, string, string?][] = [
  ["T03-0204", 1150, "Rahul Sharma", "rahul.sharma@okhdfcbank"],
  ["T05-0803", 980, "Priya Nair", "priya.nair@oksbi"],
  ["T09-1102", 1320, "Karan Mehta", "karan.mehta@ybl"],
  ["T14-0601", 1150, "Sneha Kulkarni"],
  ["T14-0602", 1150, "Omkar Kulkarni"],
  ["T18-1405", 1640, "Farah Khan", "farah.khan@paytm"],
  ["T22-0301", 780, "Deepak Patil"],
  ["T25-1204", 1320, "Meenal Joshi"],
  ["T11-0903", 980, "Arjun Reddy"],
  ["T16-0501", 1150, "Isha Bhatt"],
  ["T02-1503", 1420, "Ashok Gupta"],
];
let phoneSeq = 9100000000;
BANK_DEMO.forEach(([id, area, name, upi]) =>
  addFlat({ id, area, members: [own(name, String(phoneSeq++))], upi: upi ? [upi] : undefined, special: "bank" }),
);
// Tower 14 has the lift outage: make sure there are at least nine flats there
for (let floor = 2; floor <= 9; floor++) {
  const id = flatId(14, floor, 3);
  if (!used.has(id)) addFlat({ id, area: pick(AREAS), members: [own(`${pick(FIRST)} ${pick(LAST)}`, String(phoneSeq++))] });
}
// The rest of the township (a sample of the 2,400 flats)
while (flats.length < 88) {
  const id = flatId(int(1, 28), int(1, 16), int(1, 4));
  if (used.has(id)) continue;
  const tenant = chance(0.25);
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  const members = [own(name, String(phoneSeq++), tenant ? "TENANT" : "OWNER")];
  if (chance(0.15)) members.push(own(`${pick(FIRST)} ${name.split(" ")[1]}`, String(phoneSeq++), "FAMILY"));
  addFlat({ id, area: pick(AREAS), members, upi: chance(0.3) ? [`${name.split(" ")[0].toLowerCase()}${int(10, 99)}@okaxis`] : undefined });
}

// ---------- billing history ----------
type Profile = "punctual" | "late" | "chronic";
interface PayRec { id: string; flatId: string; amount: number; method: "UPI" | "NEFT" | "CHEQUE" | "GATEWAY"; utr: string | null; paidAt: Date }
const bills: { flatId: string; period: string; principal: number; dueDate: Date; createdAt: Date }[] = [];
const ledger: { flatId: string; type: "BILL" | "LATE_FEE" | "PAYMENT" | "CREDIT"; amount: number; period: string | null; refType: string | null; refId: string | null; note: string; createdAt: Date }[] = [];
const payments: PayRec[] = [];
const unpaidNow: string[] = []; // flats with a plain unpaid current bill and no arrears

for (const f of flats) {
  const principal = monthlyBill(f.area);
  const profile: Profile = f.special === "bank" || f.special === "neeraj" ? "punctual" : (() => { const r = rnd(); return r < 0.7 ? "punctual" : r < 0.9 ? "late" : "chronic"; })();
  const skipLast = f.special === "swati" ? 3 : profile === "chronic" ? int(2, 3) : 0;
  const myBills: BillRow[] = [];
  const myLedger: LedgerRow[] = [];

  periods.forEach((p, idx) => {
    const created = new Date(Date.UTC(p.y, p.m, 1, 6));
    const due = dueDateFor(p.key);
    myBills.push({ period: p.key, principal, dueDate: due });
    myLedger.push({ type: "BILL", amount: principal, period: p.key, createdAt: created });
    bills.push({ flatId: f.id, period: p.key, principal, dueDate: due, createdAt: created });
    ledger.push({ flatId: f.id, type: "BILL", amount: principal, period: p.key, refType: "BILL", refId: null, note: `Maintenance ${p.key}`, createdAt: created });

    const isCurrent = p.key === CURRENT;
    let payDay: number | null;
    let amountOverride: number | undefined;
    if (f.special === "neeraj") payDay = 3;
    else if (f.special === "bank") payDay = isCurrent ? null : int(3, 8);
    else if (f.special === "swati") payDay = idx >= periods.length - skipLast ? null : int(3, 8);
    else if (f.special === "aamir") {
      if (idx === periods.length - 2) { payDay = 12; amountOverride = 5000; } // partial, after the due date
      else payDay = isCurrent ? null : int(3, 8);
    } else if (skipLast && idx >= periods.length - skipLast) payDay = null;
    else payDay = profile === "late" ? int(11, 25) : int(2, 9);
    if (payDay === null) return;

    const paidAt = new Date(Date.UTC(p.y, p.m, payDay, int(6, 17), int(0, 59)));
    if (paidAt > NOW) return; // hasn't happened yet this month
    const acct = computeAccount(myBills, myLedger, paidAt);
    const amount = amountOverride ?? acct.totalDue;
    if (amount <= 0) return;
    const alloc = allocatePayment(acct, amount);
    const payId = randomUUID();
    const r = rnd();
    const method = r < 0.55 ? "UPI" : r < 0.8 ? "NEFT" : r < 0.85 ? "CHEQUE" : "GATEWAY";
    payments.push({ id: payId, flatId: f.id, amount, method, utr: method === "CHEQUE" || method === "GATEWAY" ? null : String(int(100000000000, 999999999999)), paidAt });
    for (const e of alloc.entries) {
      const row = { flatId: f.id, type: e.type as "LATE_FEE" | "PAYMENT" | "CREDIT", amount: e.amount, period: e.period, refType: e.type === "LATE_FEE" ? "LATE_FEE" : "PAYMENT", refId: payId, note: e.note, createdAt: paidAt };
      myLedger.push(row);
      ledger.push(row);
    }
  });

  const acct = computeAccount(myBills, myLedger, NOW);
  if (acct.totalDue === principal && acct.periods.filter((x) => x.outstanding > 0).length === 1 && acct.periods.at(-1)!.outstanding > 0 && f.special === undefined) unpaidNow.push(f.id);
}

payments.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
const receiptOf = new Map(payments.map((p, i) => [p.id, `RCT-${p.paidAt.getUTCFullYear()}-${pad(i + 1, 6)}`]));

// ---------- staff ----------
const STAFF = {
  helpdesk: { id: randomUUID(), phone: "9000000010", name: "Anita Deshmukh", role: "HELPDESK" as const, skills: [] as CategoryKey[] },
  committee: { id: randomUUID(), phone: "9000000020", name: "Rajan Phadke", role: "COMMITTEE" as const, skills: [] as CategoryKey[] },
  duty: { id: randomUUID(), phone: "9000000030", name: "Vikram Pawar", role: "DUTY_MANAGER" as const, skills: [] as CategoryKey[] },
  plumber: { id: randomUUID(), phone: "9000000031", name: "Sunil Gaikwad", role: "TECHNICIAN" as const, skills: ["PLUMBING"] as CategoryKey[] },
  electrician: { id: randomUUID(), phone: "9000000032", name: "Ramesh Yadav", role: "TECHNICIAN" as const, skills: ["ELECTRICAL", "LIFT"] as CategoryKey[] },
  housekeeping: { id: randomUUID(), phone: "9000000033", name: "Pooja Sonawane", role: "TECHNICIAN" as const, skills: ["HOUSEKEEPING", "PEST"] as CategoryKey[] },
  security: { id: randomUUID(), phone: "9000000034", name: "Imran Sayyed", role: "TECHNICIAN" as const, skills: ["SECURITY", "PARKING", "NOISE", "OTHER"] as CategoryKey[] },
};
const techFor = (c: CategoryKey) => Object.values(STAFF).find((s) => s.role === "TECHNICIAN" && s.skills.includes(c)) ?? STAFF.helpdesk;

// ---------- complaints ----------
const TEXTS: Record<CategoryKey, [string, UrgencyKey][]> = {
  PLUMBING: [
    ["Water is leaking from the bathroom ceiling, it looks like it is coming from the flat above.", "HIGH"],
    ["Kitchen tap is dripping all day and wasting water.", "MEDIUM"],
    ["No water supply in my flat since this morning.", "HIGH"],
    ["The wash basin drain is blocked and water is overflowing.", "HIGH"],
    ["Seepage on the bedroom wall near the window after the rain.", "MEDIUM"],
    ["Flush tank in the common bathroom keeps running.", "LOW"],
    ["बाथरूममधील नळ गळत आहे, कृपया दुरुस्त करा.", "MEDIUM"],
  ],
  ELECTRICAL: [
    ["Corridor lights on the 7th floor are not working.", "MEDIUM"],
    ["MCB keeps tripping whenever I switch on the AC.", "HIGH"],
    ["Staircase bulb is fused, it is dark at night.", "MEDIUM"],
    ["Power cut in our wing while the rest of the tower has electricity.", "HIGH"],
    ["Please replace the broken switch board in the lobby.", "LOW"],
    ["बिजली का मीटर बॉक्स खुला है, कृपया देखें।", "MEDIUM"],
  ],
  LIFT: [
    ["Lift 2 is not working since morning, we are using the stairs.", "HIGH"],
    ["Lift makes a loud grinding noise between floors.", "MEDIUM"],
    ["Lift door does not close properly on the ground floor.", "MEDIUM"],
    ["Lift display panel is not showing the floor number.", "LOW"],
  ],
  SECURITY: [
    ["An unknown person was loitering near the tower entrance last night.", "HIGH"],
    ["Guard at gate 2 was not at the post at 11 pm.", "MEDIUM"],
    ["CCTV camera in the basement is not working.", "MEDIUM"],
    ["Please install a mirror at the blind corner near the gate.", "LOW"],
  ],
  HOUSEKEEPING: [
    ["Garbage has not been collected from our floor for two days.", "MEDIUM"],
    ["Staircase between 4th and 5th floor is dirty and needs cleaning.", "LOW"],
    ["Dustbins near the parking are overflowing and smelling.", "HIGH"],
    ["सफाई कर्मचारी आज आले नाहीत, कचरा पडून आहे.", "MEDIUM"],
  ],
  PEST: [
    ["Lots of cockroaches in the kitchen and the common duct.", "MEDIUM"],
    ["Mosquito breeding in the stagnant water near the garden.", "MEDIUM"],
    ["Rats seen in the basement parking area.", "MEDIUM"],
    ["Termites on the wooden door frame of the common lobby.", "LOW"],
  ],
  PARKING: [
    ["A car is parked in my allotted slot every evening.", "MEDIUM"],
    ["Visitor vehicle blocking the exit ramp.", "HIGH"],
    ["Parking slot number is faded and needs repainting.", "LOW"],
  ],
  NOISE: [
    ["Loud music from a flat on the 9th floor after 11 pm.", "MEDIUM"],
    ["Drilling and construction noise on Sunday morning.", "MEDIUM"],
    ["Children playing cricket right under the windows late in the evening.", "LOW"],
  ],
  OTHER: [
    ["Please repaint the faded tower number board at the entrance.", "LOW"],
    ["The notice board glass is broken.", "LOW"],
    ["Request to add benches near the children's play area.", "LOW"],
  ],
};
const CAT_WEIGHTS: [CategoryKey, number][] = [["PLUMBING", 24], ["ELECTRICAL", 18], ["LIFT", 10], ["SECURITY", 8], ["HOUSEKEEPING", 16], ["PEST", 8], ["PARKING", 6], ["NOISE", 6], ["OTHER", 4]];
const pickCat = (): CategoryKey => {
  let r = rnd() * CAT_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  for (const [c, w] of CAT_WEIGHTS) if ((r -= w) < 0) return c;
  return "OTHER";
};

type ComplaintRow = {
  id: string; flatId: string; raisedById: string; text: string; photoUrl: null; category: CategoryKey; urgency: UrgencyKey;
  aiCategory: CategoryKey | null; aiUrgency: UrgencyKey | null; aiConfidence: number | null; classifiedBy: "AI" | "RULE" | "FALLBACK" | "STAFF";
  needsReview: boolean; safetyEscalated: boolean; assigneeId: string | null; status: "NEW" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";
  parentId: string | null; dueBy: Date; firstResponseAt: Date | null; resolvedAt: Date | null; rating: number | null; reopenCount: number; createdAt: Date;
};
type EventRow = { complaintId: string; actorKind: string; actorStaffId: string | null; kind: string; note: string | null; createdAt: Date };
const complaints: ComplaintRow[] = [];
const events: EventRow[] = [];

const userIdByPhone = new Map<string, string>();
const flatByUserKey = (f: FlatSpec) => userIdByPhone.get(f.members[0].phone)!;
for (const f of flats) for (const m of f.members) if (!userIdByPhone.has(m.phone)) userIdByPhone.set(m.phone, randomUUID());

function addComplaint(o: {
  flat: FlatSpec; text: string; category: CategoryKey; urgency: UrgencyKey; createdAt: Date; status: ComplaintRow["status"];
  assignee?: { id: string; name: string }; classifiedBy?: ComplaintRow["classifiedBy"]; safety?: boolean; needsReview?: boolean;
  parentId?: string | null; respondMin?: number; resolveHours?: number; rating?: number | null; reopened?: boolean; id?: string; aiCategory?: CategoryKey | null;
}) {
  const id = o.id ?? randomUUID();
  const target = RESPONSE_TARGET_MIN[o.urgency] * MIN;
  const respondMs = (o.respondMin ?? Math.round((chance(0.15) ? 1.4 : 0.15 + rnd() * 0.7) * target / MIN)) * MIN;
  const responded = o.status !== "NEW" && o.status !== "ASSIGNED" ? true : o.status === "ASSIGNED" ? false : false;
  const firstResponseAt = responded ? new Date(o.createdAt.getTime() + respondMs) : null;
  const resolvedAt = o.status === "RESOLVED" || o.status === "CLOSED" ? new Date(o.createdAt.getTime() + respondMs + (o.resolveHours ?? int(2, 60)) * HOUR) : null;
  const by = o.classifiedBy ?? (chance(0.82) ? "AI" : chance(0.5) ? "FALLBACK" : "STAFF");
  const assignee = o.assignee ?? techFor(o.category);
  complaints.push({
    id, flatId: o.flat.id, raisedById: flatByUserKey(o.flat), text: o.text, photoUrl: null, category: o.category, urgency: o.urgency,
    aiCategory: by === "AI" ? o.category : by === "STAFF" ? (o.aiCategory ?? "OTHER") : null,
    aiUrgency: by === "AI" || by === "STAFF" ? o.urgency : null,
    aiConfidence: by === "AI" ? Math.round((0.7 + rnd() * 0.28) * 100) / 100 : by === "STAFF" ? 0.62 : null,
    classifiedBy: by, needsReview: o.needsReview ?? false, safetyEscalated: o.safety ?? false, assigneeId: assignee.id, status: o.status,
    parentId: o.parentId ?? null, dueBy: new Date(o.createdAt.getTime() + target), firstResponseAt, resolvedAt,
    rating: o.rating ?? null, reopenCount: o.reopened ? 1 : 0, createdAt: o.createdAt,
  });
  const ev = (kind: string, note: string, at: Date, actorKind = "SYSTEM", staffId: string | null = null) => events.push({ complaintId: id, actorKind, actorStaffId: staffId, kind, note, createdAt: at });
  ev("CREATED", "Complaint raised", o.createdAt, "RESIDENT");
  const how = by === "RULE" ? "Safety rule triggered. Duty manager notified" : by === "AI" ? "AI classified" : by === "STAFF" ? "Help desk corrected the category" : "AI unavailable; used keyword rules";
  ev("CLASSIFIED", `${CATEGORY_LABEL[o.category]} · ${o.urgency.toLowerCase()}. ${how}`, new Date(o.createdAt.getTime() + 1000));
  ev("ASSIGNED", `Assigned to ${assignee.name}`, new Date(o.createdAt.getTime() + 2000));
  if (o.parentId) ev("LINKED", "Linked to an earlier report of the same issue. Not closed.", new Date(o.createdAt.getTime() + 3000));
  if (firstResponseAt) ev("STATUS", "in progress", firstResponseAt, "STAFF", assignee.id);
  if (resolvedAt) ev("STATUS", "resolved", resolvedAt, "STAFF", assignee.id);
  if (o.status === "CLOSED" && resolvedAt) ev("RATED", `Closed with ${o.rating}/5`, new Date(resolvedAt.getTime() + int(1, 20) * HOUR), "RESIDENT");
  if (o.reopened && resolvedAt) ev("REOPENED", "Resident says the problem is not fixed", new Date(resolvedAt.getTime() + 2 * HOUR), "RESIDENT");
  return id;
}

// ~110 historical and in-flight complaints over the last 60 days
const pool = flats.filter((f) => f.special !== "bank");
for (let i = 0; i < 110; i++) {
  const flat = pick(pool);
  const category = pickCat();
  const [text, urgency] = pick(TEXTS[category]);
  const ageDays = rnd() ** 1.4 * 60;
  const createdAt = new Date(NOW.getTime() - ageDays * DAY - int(0, 12) * HOUR);
  let status: ComplaintRow["status"];
  const reopened = ageDays > 6 && chance(0.09);
  if (ageDays > 6) status = chance(0.93) ? "CLOSED" : "RESOLVED";
  else if (ageDays > 2) status = pick(["CLOSED", "RESOLVED", "IN_PROGRESS", "IN_PROGRESS"] as const);
  else status = pick(["ASSIGNED", "IN_PROGRESS", "IN_PROGRESS", "NEW", "RESOLVED"] as const);
  if (flat.special === "aamir" || flat.special === "neeraj") status = "CLOSED"; // the brief: these two have no open complaints
  addComplaint({
    flat, text, category, urgency, createdAt, status, reopened,
    rating: status === "CLOSED" ? (reopened ? int(2, 3) : pick([5, 5, 5, 4, 4, 4, 3, 2])) : null,
    ...(status === "NEW" ? { classifiedBy: "FALLBACK" as const, needsReview: chance(0.6) } : {}),
  });
}

// Swati's open water leak (from the brief)
const swati = flats.find((f) => f.special === "swati")!;
addComplaint({
  flat: swati, text: "Water is leaking from the bathroom ceiling, coming from the flat above. It has been three days and the wall is getting damp.",
  category: "PLUMBING", urgency: "HIGH", createdAt: new Date(NOW.getTime() - 2 * DAY), status: "IN_PROGRESS", classifiedBy: "AI", respondMin: 190,
});

// Tower 14 lift outage: nine flats, one root complaint, eight linked duplicates (never auto-closed)
const t14 = flats.filter((f) => f.id.startsWith("T14-")).slice(0, 9);
const liftTexts = ["Lift 2 is not working since morning.", "Lift is down again, we have to use the stairs with groceries.", "Lift not working, please fix urgently, elderly residents on the 9th floor.", "The tower 14 lift has stopped working.", "Lift out of order. This is the second time this week.", "Lift not coming to our floor at all.", "Lift is not working, please check.", "Lift 2 dead since 7 am.", "Lift not working in tower 14."];
let liftRoot: string | null = null;
t14.forEach((flat, i) => {
  const at = new Date(NOW.getTime() - 3 * HOUR + i * 14 * MIN);
  const id = addComplaint({
    flat, text: liftTexts[i], category: "LIFT", urgency: "HIGH", createdAt: at, status: i === 0 ? "IN_PROGRESS" : "ASSIGNED",
    assignee: STAFF.electrician, classifiedBy: "AI", parentId: liftRoot, respondMin: 25,
  });
  if (!liftRoot) liftRoot = id;
});

// Gas smell: safety rule always escalates to the duty manager
const gasFlat = pick(flats.filter((f) => f.id.startsWith("T05-") || f.id.startsWith("T09-")));
addComplaint({
  flat: gasFlat, text: "Strong smell of gas near the staircase on our floor. Please send someone immediately.", category: "OTHER",
  urgency: "CRITICAL", createdAt: new Date(NOW.getTime() - 40 * MIN), status: "IN_PROGRESS", classifiedBy: "RULE", safety: true,
  assignee: STAFF.duty, respondMin: 8,
});

// Vague complaint the AI was unsure about: waits for the help desk to categorise
addComplaint({
  flat: pick(pool.filter((f) => f.special === undefined)), text: "Please check the problem outside my door, it is getting worse.", category: "OTHER", urgency: "MEDIUM",
  createdAt: new Date(NOW.getTime() - 70 * MIN), status: "ASSIGNED", classifiedBy: "FALLBACK", needsReview: true, assignee: STAFF.helpdesk,
});

complaints.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

// ---------- notices ----------
const NOTICES = [
  { title: "Water tank cleaning on Saturday", body: "Water supply will be off from 10 am to 2 pm this Saturday for the quarterly tank cleaning. Please store water in advance.", ago: 1 },
  { title: "Annual General Meeting", body: "The AGM is on the last Sunday of this month at 11 am in the clubhouse. Maintenance accounts for the year will be presented.", ago: 3 },
  { title: "Lift servicing in towers 10 to 14", body: "Annual lift servicing runs over the next two weeks, one lift per tower at a time. Thank you for your patience.", ago: 5 },
  { title: "Fire safety drill", body: "A fire safety drill will be held in all towers next Wednesday at 5 pm. Please take part and learn your tower's assembly point.", ago: 9 },
  { title: "Maintenance is due by the 10th", body: "Pay on or before the 10th of every month to avoid late fees under the society bye-laws. You can pay in the app.", ago: 12 },
];

// ---------- bank import already waiting in the queue ----------
const queueFlats = unpaidNow.slice(0, 2);

// ---------- write everything ----------
async function main() {
  await db.complaintEvent.deleteMany();
  await db.complaint.deleteMany();
  await db.bankRow.deleteMany();
  await db.bankImport.deleteMany();
  await db.ledgerEntry.deleteMany();
  await db.payment.deleteMany();
  await db.bill.deleteMany();
  await db.knownUpiId.deleteMany();
  await db.membership.deleteMany();
  await db.user.deleteMany();
  await db.staff.deleteMany();
  await db.notice.deleteMany();
  await db.flat.deleteMany();

  await db.flat.createMany({ data: flats.map((f) => ({ id: f.id, tower: +f.id.slice(1, 3), number: f.id.slice(4), areaSqft: f.area })) });
  const people = new Map<string, string>();
  for (const f of flats) for (const m of f.members) people.set(m.phone, m.name);
  await db.user.createMany({ data: [...people].map(([phone, name]) => ({ id: userIdByPhone.get(phone)!, phone, name, locale: "en" })) });
  await db.membership.createMany({ data: flats.flatMap((f) => f.members.map((m) => ({ userId: userIdByPhone.get(m.phone)!, flatId: f.id, kind: m.kind }))) });
  await db.knownUpiId.createMany({ data: flats.flatMap((f) => (f.upi ?? []).map((vpa) => ({ flatId: f.id, vpa }))) });
  await db.staff.createMany({ data: Object.values(STAFF) });
  await db.notice.createMany({ data: NOTICES.map((n) => ({ title: n.title, body: n.body, publishedAt: new Date(NOW.getTime() - n.ago * DAY) })) });

  await insert(bills, (c) => db.bill.createMany({ data: c }));
  await insert(payments, (c) =>
    db.payment.createMany({
      data: c.map((p) => ({ id: p.id, flatId: p.flatId, amount: p.amount, method: p.method, status: "SUCCEEDED" as const, source: p.method === "GATEWAY" ? ("GATEWAY" as const) : ("BANK" as const), utr: p.utr, receiptNo: receiptOf.get(p.id), paidAt: p.paidAt, createdAt: p.paidAt })),
    }),
  );
  await insert(ledger, (c) => db.ledgerEntry.createMany({ data: c }));

  // One earlier statement import whose uncertain rows are still waiting for the accounts desk
  const imp = await db.bankImport.create({ data: { fileName: "hdfc-statement-oct-week4.csv", fileHash: "seed-" + randomUUID(), uploadedBy: "seed", rowCount: 3 } });
  const when = new Date(NOW.getTime() - 3 * DAY);
  const q = queueFlats[0];
  await db.bankRow.createMany({
    data: [
      ...(q ? [{
        importId: imp.id, rowHash: "seed-1", txnDate: when, amount: 3000, narration: `UPI/402211998877/${q} MAINT PART PAYMENT`, utr: "402211998877",
        status: "REVIEW" as const, suggestedFlatId: q, score: 70, reasons: [`Flat ID ${q} in reference +60`, "Partial payment +10"], candidates: [{ flatId: q, score: 70, reasons: [`Flat ID ${q} in reference +60`, "Partial payment +10"] }],
      }] : []),
      { importId: imp.id, rowHash: "seed-2", txnDate: when, amount: 5000, narration: "UPI/402211998878/maintenance/anonymous@upi", utr: "402211998878", status: "UNMATCHED" as const, score: 0, reasons: ["No flat ID, registered UPI ID or payer name found"], candidates: [] },
      { importId: imp.id, rowHash: "seed-3", txnDate: when, amount: 412, narration: "INT.PD:01-07-2026 TO 30-09-2026", status: "UNMATCHED" as const, score: 0, reasons: ["No flat ID, registered UPI ID or payer name found"], candidates: [] },
    ],
  });

  // Parents first so the self-reference always resolves
  await db.complaint.createMany({ data: complaints.filter((c) => !c.parentId) });
  await db.complaint.createMany({ data: complaints.filter((c) => c.parentId) });
  await insert(events, (c) => db.complaintEvent.createMany({ data: c }));

  console.log(`Seeded ${flats.length} flats, ${bills.length} bills, ${payments.length} payments, ${complaints.length} complaints`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
