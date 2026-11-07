// Small in-memory limiter for OTP attempts. Per server instance, which is enough for a demo.
// A production build would use a shared store (Redis / the database) so limits hold across instances.
const hits = new Map<string, number[]>();

const recent = (key: string, windowMs: number) => (hits.get(key) ?? []).filter((t) => Date.now() - t < windowMs);

/** True once `max` failures have been recorded inside the window. Does not count this call. */
export function isLimited(key: string, max: number, windowMs: number): boolean {
  return recent(key, windowMs).length >= max;
}

export function recordFailure(key: string, windowMs: number) {
  hits.set(key, [...recent(key, windowMs), Date.now()]);
}

export function clearFailures(key: string) {
  hits.delete(key);
}

/** Counts every call (for things like "requests per minute"). */
export function tooMany(key: string, max: number, windowMs: number): boolean {
  const r = recent(key, windowMs);
  r.push(Date.now());
  hits.set(key, r);
  return r.length > max;
}
