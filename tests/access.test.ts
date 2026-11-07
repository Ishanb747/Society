import { describe, expect, it } from "vitest";
import { canAccessFlat, homeFor, staffCan, type SessionLike } from "@/lib/access";

const resident: SessionLike = { k: "resident", id: "u1", flat: "T12-0408" };

describe("resident access", () => {
  it("can only reach their own active flat", () => {
    expect(canAccessFlat(resident, "T12-0408")).toBe(true);
    expect(canAccessFlat(resident, "T07-1203")).toBe(false);
  });
  it("anonymous and staff sessions have no flat access", () => {
    expect(canAccessFlat(null, "T12-0408")).toBe(false);
    expect(canAccessFlat({ k: "staff", id: "s1", role: "HELPDESK" }, "T12-0408")).toBe(false);
  });
});

describe("staff access", () => {
  it("only the help desk (accounts) can post payments", () => {
    expect(staffCan("HELPDESK", "payments")).toBe(true);
    for (const r of ["COMMITTEE", "DUTY_MANAGER", "TECHNICIAN"] as const) expect(staffCan(r, "payments")).toBe(false);
  });
  it("the committee reads reports but cannot touch complaints", () => {
    expect(staffCan("COMMITTEE", "committee")).toBe(true);
    expect(staffCan("COMMITTEE", "desk")).toBe(false);
  });
  it("technicians and the duty manager work the complaint queue only", () => {
    expect(staffCan("TECHNICIAN", "desk")).toBe(true);
    expect(staffCan("DUTY_MANAGER", "desk")).toBe(true);
    expect(staffCan("TECHNICIAN", "committee")).toBe(false);
  });
  it("sends each role to its home screen", () => {
    expect(homeFor("COMMITTEE")).toBe("/committee");
    expect(homeFor("HELPDESK")).toBe("/desk");
  });
});
