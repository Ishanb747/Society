// Who may see what. Pure, so it can be tested without a database.
export type StaffRoleKey = "HELPDESK" | "COMMITTEE" | "DUTY_MANAGER" | "TECHNICIAN";
export type Area = "desk" | "payments" | "committee";

const MATRIX: Record<Area, StaffRoleKey[]> = {
  desk: ["HELPDESK", "DUTY_MANAGER", "TECHNICIAN"],
  payments: ["HELPDESK"], // only the accounts desk may post money to a flat
  committee: ["COMMITTEE", "HELPDESK"],
};

export function staffCan(role: StaffRoleKey, area: Area): boolean {
  return MATRIX[area].includes(role);
}

export function homeFor(role: StaffRoleKey): string {
  return role === "COMMITTEE" ? "/committee" : "/desk";
}

export type SessionLike = { k: "resident"; id: string; flat: string } | { k: "staff"; id: string; role: StaffRoleKey };

/** A resident only ever sees their own active flat's data. */
export function canAccessFlat(session: SessionLike | null, flatId: string): boolean {
  return !!session && session.k === "resident" && session.flat === flatId;
}
