const TZ = "Asia/Kolkata";

export const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ }).format(d);
export const fmtDateLong = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);
export const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }).format(d);

export function fmtMonth(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** 135 -> "2h 15m", 45 -> "45m", 3000 -> "2d 2h" */
export function fmtMinutes(min: number) {
  const m = Math.round(Math.abs(min));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`.replace(" 0m", "");
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`.replace(" 0h", "");
}

export function ago(d: Date, now = new Date()) {
  const min = (now.getTime() - d.getTime()) / 60_000;
  if (min < 1) return "just now";
  if (min < 60 * 24 * 7) return `${fmtMinutes(min)} ago`;
  return fmtDate(d);
}
