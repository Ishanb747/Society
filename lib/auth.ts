import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { homeFor, staffCan, type Area, type SessionLike, type StaffRoleKey } from "./access";

const COOKIE = "session";
const MAX_AGE_S = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function createSession(payload: SessionLike) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionLike | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.k === "resident" && typeof payload.id === "string" && typeof payload.flat === "string") {
      return { k: "resident", id: payload.id, flat: payload.flat };
    }
    if (payload.k === "staff" && typeof payload.id === "string" && typeof payload.role === "string") {
      return { k: "staff", id: payload.id, role: payload.role as StaffRoleKey };
    }
    return null;
  } catch {
    return null;
  }
}

/** Resident pages and actions: the session must be a resident with a live membership of the active flat. */
export const requireResident = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.k === "staff") redirect(homeFor(session.role));
  const user = await db.user.findUnique({
    where: { id: session.id },
    include: { memberships: { include: { flat: true }, orderBy: { flatId: "asc" } } },
  });
  const membership = user?.memberships.find((m) => m.flatId === session.flat);
  if (!user || !membership) {
    redirect("/api/session/clear");
  }
  return { user, flat: membership.flat, membership, memberships: user.memberships };
});

/** Staff pages and actions, optionally limited to an area. Residents are sent home, strangers to login. */
export const requireStaff = cache(async (area?: Area) => {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.k === "resident") redirect("/home");
  const staff = await db.staff.findUnique({ where: { id: session.id } });
  if (!staff) {
    redirect("/api/session/clear");
  }
  if (area && !staffCan(staff.role, area)) redirect(homeFor(staff.role));
  return staff;
});
