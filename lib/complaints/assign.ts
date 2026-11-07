import type { CategoryKey } from "@/lib/constants";

export interface StaffLoad {
  id: string;
  role: "HELPDESK" | "COMMITTEE" | "DUTY_MANAGER" | "TECHNICIAN";
  skills: CategoryKey[];
  openCount: number;
}

/** Safety escalations go to the duty manager; otherwise the skilled technician with the fewest open tickets. */
export function pickAssignee(staff: StaffLoad[], category: CategoryKey, safetyEscalated: boolean): string | null {
  const least = (xs: StaffLoad[]) => [...xs].sort((a, b) => a.openCount - b.openCount || a.id.localeCompare(b.id))[0]?.id ?? null;
  if (safetyEscalated) {
    const dm = least(staff.filter((s) => s.role === "DUTY_MANAGER"));
    if (dm) return dm;
  }
  const skilled = least(staff.filter((s) => s.role === "TECHNICIAN" && s.skills.includes(category)));
  return skilled ?? least(staff.filter((s) => s.role === "HELPDESK"));
}
