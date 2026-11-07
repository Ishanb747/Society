export const CATEGORIES = [
  "PLUMBING",
  "ELECTRICAL",
  "LIFT",
  "SECURITY",
  "HOUSEKEEPING",
  "PEST",
  "PARKING",
  "NOISE",
  "OTHER",
] as const;
export type CategoryKey = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  LIFT: "Lift",
  SECURITY: "Security",
  HOUSEKEEPING: "Housekeeping",
  PEST: "Pest control",
  PARKING: "Parking",
  NOISE: "Noise",
  OTHER: "Other",
};

export const URGENCIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type UrgencyKey = (typeof URGENCIES)[number];

export const URGENCY_LABEL: Record<UrgencyKey, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const STATUSES = ["NEW", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"] as const;
export type StatusKey = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<StatusKey, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

export const OPEN_STATUSES: StatusKey[] = ["NEW", "ASSIGNED", "IN_PROGRESS", "REOPENED"];

// ASSUMPTION: response targets by urgency (minutes). The brief asks for a response timer but gives no targets.
export const RESPONSE_TARGET_MIN: Record<UrgencyKey, number> = {
  CRITICAL: 30,
  HIGH: 240,
  MEDIUM: 1440,
  LOW: 4320,
};

export const DEMO_OTP = "123456";
export const FLAT_ID_RE = /^T\d{2}-\d{4}$/;
