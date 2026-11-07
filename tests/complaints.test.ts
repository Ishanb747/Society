import { describe, expect, it } from "vitest";
import { classifyComplaint } from "@/lib/complaints/classify";
import { findDuplicateParent, similarity } from "@/lib/complaints/duplicates";
import { keywordClassify } from "@/lib/complaints/keywords";
import { detectSafety } from "@/lib/complaints/safety";
import { pickAssignee, type StaffLoad } from "@/lib/complaints/assign";

const aiSays = (category: string, urgency: string, confidence: number) => async () =>
  ({ category, urgency, confidence }) as never;

describe("safety rule", () => {
  it.each([
    "There is a fire on the 5th floor",
    "Smell of gas in the corridor",
    "Lift stuck with an old lady inside",
    "I got an electric shock from the switch",
    "Sparks coming from the meter box",
    "लिफ्ट अडकली आहे",
    "गैस की बदबू आ रही है",
  ])("flags: %s", (text) => {
    expect(detectSafety(text).length).toBeGreaterThan(0);
  });
  it("does not flag ordinary complaints", () => {
    expect(detectSafety("Tap in kitchen is dripping")).toEqual([]);
  });
});

describe("classifyComplaint", () => {
  it("escalates safety words to CRITICAL even when the AI says low urgency", async () => {
    const r = await classifyComplaint("Lift stuck between floors", { ai: aiSays("LIFT", "LOW", 0.99) });
    expect(r).toMatchObject({ urgency: "CRITICAL", safetyEscalated: true, classifiedBy: "RULE", category: "LIFT" });
  });

  it("escalates even when the AI is down", async () => {
    const r = await classifyComplaint("smell of gas", { ai: async () => null });
    expect(r.safetyEscalated).toBe(true);
    expect(r.urgency).toBe("CRITICAL");
  });

  it("uses the AI when it is confident", async () => {
    const r = await classifyComplaint("water dripping from ceiling", { ai: aiSays("PLUMBING", "HIGH", 0.9) });
    expect(r).toMatchObject({ category: "PLUMBING", urgency: "HIGH", classifiedBy: "AI", needsReview: false });
  });

  it("falls back to keywords when the AI is unsure", async () => {
    const r = await classifyComplaint("the tap is leaking", { ai: aiSays("OTHER", "LOW", 0.3) });
    expect(r.classifiedBy).toBe("FALLBACK");
    expect(r.category).toBe("PLUMBING");
  });

  it("falls back to keywords when the AI call fails or there is no key", async () => {
    const r = await classifyComplaint("tap leaking and water on the floor", { ai: async () => { throw new Error("timeout"); } });
    expect(r.classifiedBy).toBe("FALLBACK");
    expect(r.category).toBe("PLUMBING");
  });

  it("flags vague complaints for the help desk", async () => {
    const r = await classifyComplaint("please check", { ai: async () => null });
    expect(r).toMatchObject({ category: "OTHER", needsReview: true });
  });
});

describe("keywordClassify", () => {
  it("picks a category and detects urgency", () => {
    expect(keywordClassify("No water since morning")).toMatchObject({ category: "PLUMBING", urgency: "HIGH" });
    expect(keywordClassify("Please suggest adding a bench").urgency).toBe("LOW");
  });
});

describe("duplicates", () => {
  const now = new Date("2026-11-07T10:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
  const existing = [
    { id: "a", category: "LIFT" as const, text: "Lift 2 not working", tower: 14, createdAt: hoursAgo(3), parentId: null },
    { id: "b", category: "LIFT" as const, text: "lift is down again", tower: 14, createdAt: hoursAgo(2), parentId: "a" },
    { id: "c", category: "PLUMBING" as const, text: "Water leaking from ceiling in bathroom", tower: 14, createdAt: hoursAgo(5), parentId: null },
  ];

  it("links a lift complaint in the same tower to the root, however it is worded", () => {
    expect(findDuplicateParent({ category: "LIFT", text: "stopped working", tower: 14, createdAt: now }, existing)).toBe("a");
  });
  it("links similar wording in the same tower and category", () => {
    expect(findDuplicateParent({ category: "PLUMBING", text: "water leaking from bathroom ceiling", tower: 14, createdAt: now }, existing)).toBe("c");
  });
  it("does not link across towers, categories or after 24 hours", () => {
    expect(findDuplicateParent({ category: "LIFT", text: "lift down", tower: 15, createdAt: now }, existing)).toBeNull();
    expect(findDuplicateParent({ category: "PLUMBING", text: "totally different words here", tower: 14, createdAt: now }, existing)).toBeNull();
    const old = [{ ...existing[0], createdAt: hoursAgo(30) }];
    expect(findDuplicateParent({ category: "LIFT", text: "lift down", tower: 14, createdAt: now }, old)).toBeNull();
  });
  it("scores similarity between 0 and 1", () => {
    expect(similarity("water leak bathroom", "water leak bathroom")).toBe(1);
    expect(similarity("water leak", "garbage dustbin")).toBe(0);
  });
});

describe("pickAssignee", () => {
  const staff: StaffLoad[] = [
    { id: "dm", role: "DUTY_MANAGER", skills: [], openCount: 1 },
    { id: "p1", role: "TECHNICIAN", skills: ["PLUMBING"], openCount: 4 },
    { id: "p2", role: "TECHNICIAN", skills: ["PLUMBING"], openCount: 1 },
    { id: "hd", role: "HELPDESK", skills: [], openCount: 0 },
  ];
  it("sends safety escalations to the duty manager", () => expect(pickAssignee(staff, "PLUMBING", true)).toBe("dm"));
  it("picks the least loaded skilled technician", () => expect(pickAssignee(staff, "PLUMBING", false)).toBe("p2"));
  it("falls back to the help desk when nobody has the skill", () => expect(pickAssignee(staff, "PEST", false)).toBe("hd"));
});
