import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

let tableReady = false;

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WaterLog" (
      id TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      date TEXT NOT NULL,
      glasses INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "WaterLog_pkey" PRIMARY KEY (id),
      CONSTRAINT "WaterLog_userId_date_key" UNIQUE ("userId", date),
      CONSTRAINT "WaterLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = new URL(req.url).searchParams.get("date") || new Date().toISOString().slice(0, 10);

  if (!tableReady) { await ensureTable().catch(() => {}); tableReady = true; }

  const rows = await prisma.$queryRawUnsafe<{ glasses: number }[]>(
    `SELECT glasses FROM "WaterLog" WHERE "userId" = $1 AND date = $2`,
    session.user.id, date
  ).catch(() => [] as { glasses: number }[]);

  return NextResponse.json({ glasses: rows[0]?.glasses ?? 0 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { date?: string; glasses?: number };
  if (typeof body.glasses !== "number") return NextResponse.json({ error: "glasses required" }, { status: 400 });

  const d = body.date || new Date().toISOString().slice(0, 10);
  const glasses = Math.max(0, Math.min(12, body.glasses));

  if (!tableReady) { await ensureTable(); tableReady = true; }

  const id = `wl_${session.user.id.slice(-6)}_${d.replace(/-/g, "")}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "WaterLog" (id, "userId", date, glasses) VALUES ($1, $2, $3, $4)
     ON CONFLICT ("userId", date) DO UPDATE SET glasses = EXCLUDED.glasses`,
    id, session.user.id, d, glasses
  );

  return NextResponse.json({ glasses });
}
