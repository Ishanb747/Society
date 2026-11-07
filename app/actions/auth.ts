"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { homeFor } from "@/lib/access";
import { createSession, destroySession, getSession } from "@/lib/auth";
import { DEMO_OTP } from "@/lib/constants";
import { db } from "@/lib/db";
import { LANGS } from "@/lib/i18n";
import { clearFailures, isLimited, recordFailure, tooMany } from "@/lib/rate-limit";
import { flatIdSchema, otpSchema, phoneSchema } from "@/lib/validation";

export type LoginState = { step: "phone" | "otp"; phone?: string; error?: string };

async function known(phone: string) {
  const [user, staff] = await Promise.all([db.user.findUnique({ where: { phone } }), db.staff.findUnique({ where: { phone } })]);
  return { user, staff };
}

// OTP is mocked: SMS delivery is out of scope, so every account's code is the demo code.
export async function requestOtp(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) return { step: "phone", error: parsed.error.issues[0].message };
  if (tooMany(`otp:${parsed.data}`, 20, 10 * 60_000)) return { step: "phone", error: "Too many attempts. Try again in a few minutes." };
  const { user, staff } = await known(parsed.data);
  if (!user && !staff) return { step: "phone", error: "This number is not linked to a flat. Ask the help desk to add it." };
  return { step: "otp", phone: parsed.data };
}

export async function verifyOtp(prev: LoginState, formData: FormData): Promise<LoginState> {
  const phone = phoneSchema.safeParse(formData.get("phone"));
  const otp = otpSchema.safeParse(formData.get("otp"));
  if (!phone.success) return { step: "phone", error: "Enter your mobile number again" };
  if (!otp.success) return { step: "otp", phone: phone.data, error: otp.error.issues[0].message };
  const key = `verify:${phone.data}`;
  const WINDOW = 10 * 60_000;
  // Only wrong codes count toward the limit; signing in correctly never locks anyone out.
  if (isLimited(key, 5, WINDOW)) return { step: "otp", phone: phone.data, error: "Too many wrong codes. Try again in a few minutes." };
  if (otp.data !== DEMO_OTP) {
    recordFailure(key, WINDOW);
    return { step: "otp", phone: phone.data, error: "That code is not right. Try again." };
  }
  clearFailures(key);

  const { user, staff } = await known(phone.data);
  if (staff) {
    await createSession({ k: "staff", id: staff.id, role: staff.role });
    redirect(homeFor(staff.role));
  }
  if (user) {
    const m = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { flatId: "asc" } });
    if (!m) return { step: "phone", error: "This number is not linked to a flat yet." };
    await createSession({ k: "resident", id: user.id, flat: m.flatId });
    redirect("/");
  }
  return { step: "phone", error: "Could not sign you in." };
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function switchFlat(formData: FormData) {
  // Deliberately not requireResident(): it is cached per request, and this request re-renders the
  // page after the action, which must see the new flat.
  const session = await getSession();
  if (!session || session.k !== "resident") redirect("/login");
  const flatId = flatIdSchema.parse(formData.get("flatId"));
  const m = await db.membership.findUnique({ where: { userId_flatId: { userId: session.id, flatId } } });
  if (!m) return; // not your flat
  await createSession({ k: "resident", id: session.id, flat: flatId });
  revalidatePath("/", "layout"); // the client then calls router.refresh() with the new cookie
}

export async function setLanguage(formData: FormData) {
  const lang = z.enum(LANGS).parse(formData.get("lang"));
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (await getSession()) revalidatePath("/", "layout");
}
