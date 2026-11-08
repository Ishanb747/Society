import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

// A signed cookie that points at a user or flat that no longer exists lands here. Cookies can only be
// changed in a route handler or server action, never while a page renders.
export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url));
}
