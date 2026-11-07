import { connection } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  await connection(); // render at request time, never at build
  try {
    const flats = await db.flat.count();
    return Response.json({ ok: true, flats });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
