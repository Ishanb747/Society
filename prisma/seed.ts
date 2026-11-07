import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// Idempotent: safe to run on every deploy. Full demo data comes in the next phase.
const SAMPLE = [
  { flat: "T07-1203", tower: 7, number: "1203", area: 1150, phone: "9000000001", name: "Neeraj Kulkarni", kind: "OWNER" },
  { flat: "T12-0408", tower: 12, number: "0408", area: 980, phone: "9000000002", name: "Swati Joshi", kind: "TENANT" },
  { flat: "T21-1601", tower: 21, number: "1601", area: 1640, phone: "9000000003", name: "Aamir Shaikh", kind: "OWNER" },
] as const;

async function main() {
  for (const s of SAMPLE) {
    await db.flat.upsert({
      where: { id: s.flat },
      update: { areaSqft: s.area },
      create: { id: s.flat, tower: s.tower, number: s.number, areaSqft: s.area },
    });
    const user = await db.user.upsert({
      where: { phone: s.phone },
      update: { name: s.name },
      create: { phone: s.phone, name: s.name },
    });
    await db.membership.upsert({
      where: { userId_flatId: { userId: user.id, flatId: s.flat } },
      update: { kind: s.kind },
      create: { userId: user.id, flatId: s.flat, kind: s.kind },
    });
  }
  console.log(`Seeded ${SAMPLE.length} flats`);
}

main().finally(() => db.$disconnect());
