import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type MeasRow = {
  id: string; date: string;
  height: number | null; waist: number | null; hips: number | null;
  chest: number | null; bicep: number | null; bodyFat: number | null;
};

let ready = false;

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BodyMeasurement" (
      id TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      date TEXT NOT NULL,
      height REAL,
      waist REAL,
      hips REAL,
      chest REAL,
      bicep REAL,
      "bodyFat" REAL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY (id),
      CONSTRAINT "BodyMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
    )
  `);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ready) { await ensureTable().catch(() => {}); ready = true; }

  const rows = await prisma.$queryRawUnsafe<MeasRow[]>(
    `SELECT id, date, height, waist, hips, chest, bicep, "bodyFat"
     FROM "BodyMeasurement" WHERE "userId" = $1 ORDER BY date DESC`,
    session.user.id
  ).catch(() => [] as MeasRow[]);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ready) { await ensureTable().catch(() => {}); ready = true; }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { date, height, waist, hips, chest, bicep, bodyFat } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const id = `bm_${Math.random().toString(36).slice(2, 11)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "BodyMeasurement" (id, "userId", date, height, waist, hips, chest, bicep, "bodyFat")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    id, session.user.id, String(date),
    height != null ? Number(height) : null,
    waist != null ? Number(waist) : null,
    hips != null ? Number(hips) : null,
    chest != null ? Number(chest) : null,
    bicep != null ? Number(bicep) : null,
    bodyFat != null ? Number(bodyFat) : null,
  );

  return NextResponse.json({ id, date, height, waist, hips, chest, bicep, bodyFat });
}
