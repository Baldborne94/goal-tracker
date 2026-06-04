import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type SleepRow = { id: string; date: string; hours: number; quality: number };

let ready = false;

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SleepLog" (
      id TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      date TEXT NOT NULL,
      hours REAL NOT NULL,
      quality INTEGER NOT NULL DEFAULT 3,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SleepLog_pkey" PRIMARY KEY (id),
      CONSTRAINT "SleepLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE,
      CONSTRAINT "SleepLog_userId_date_key" UNIQUE ("userId", date)
    )
  `);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  if (!ready) { await ensureTable().catch(() => {}); ready = true; }

  const { searchParams } = new URL(req.url);
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);

  const rows = await prisma.$queryRawUnsafe<SleepRow[]>(
    `SELECT id, date, hours, quality FROM "SleepLog"
     WHERE "userId" = $1 AND date >= $2 ORDER BY date DESC`,
    userId, since
  ).catch(() => [] as SleepRow[]);

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  if (!ready) { await ensureTable().catch(() => {}); ready = true; }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { date, hours, quality } = body;

  if (!date || !hours) return NextResponse.json({ error: "date and hours required" }, { status: 400 });

  const h = Math.min(24, Math.max(0, Number(hours)));
  const q = Math.min(5, Math.max(1, Number(quality ?? 3)));
  const d = String(date);

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "SleepLog" WHERE "userId" = $1 AND date = $2`, userId, d
  ).catch(() => [] as { id: string }[]);

  let id: string;
  if (existing.length > 0) {
    id = existing[0].id;
    await prisma.$executeRawUnsafe(
      `UPDATE "SleepLog" SET hours = $1, quality = $2 WHERE id = $3`, h, q, id
    );
  } else {
    id = `sl_${Math.random().toString(36).slice(2, 11)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SleepLog" (id, "userId", date, hours, quality) VALUES ($1, $2, $3, $4, $5)`,
      id, userId, d, h, q
    );
  }

  return NextResponse.json({ id, date: d, hours: h, quality: q });
}
