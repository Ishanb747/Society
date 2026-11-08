import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  // Pooled Neon connection string (-pooler): right for serverless/web traffic.
  // Migrations use DATABASE_URL_UNPOOLED, see prisma.config.ts.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10_000, // drop idle sockets before Neon does, so a dead connection is never reused
    connectionTimeoutMillis: 15_000, // allow for a cold start of a suspended Neon compute
    keepAlive: true,
  });
  // An idle client killed by the server must not take the process down or poison the next request.
  pool.on("error", (e) => console.error("pg pool error (ignored, client discarded):", e.message));
  // On Vercel (Fluid compute) this closes idle clients before the function is suspended.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const db = globalForPrisma.prisma ?? create();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
