import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

let tableReady = false;

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QuestCheckIn" (
      "id" TEXT NOT NULL,
      "goalId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "note" TEXT,
      "xpAwarded" INTEGER NOT NULL DEFAULT 5,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "QuestCheckIn_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "QuestCheckIn_goalId_userId_date_key" UNIQUE ("goalId", "userId", "date"),
      CONSTRAINT "QuestCheckIn_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "QuestCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "dailyCheckIn" BOOLEAN DEFAULT false`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "checkInXP" INTEGER DEFAULT 5`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Goal" ADD COLUMN IF NOT EXISTS "checkInDays" TEXT`);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: goalId } = await params;

  if (!tableReady) {
    try { await ensureTable(); tableReady = true; }
    catch { return NextResponse.json([]); }
  }

  const checkIns = await prisma.$queryRawUnsafe<{ id: string; date: string; note: string | null; xpAwarded: number }[]>(
    `SELECT id, date, note, "xpAwarded" FROM "QuestCheckIn" WHERE "goalId" = $1 AND "userId" = $2 ORDER BY date DESC`,
    goalId, session.user.id
  );

  return NextResponse.json(checkIns);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: goalId } = await params;
  const body = await req.json().catch(() => ({}));
  const { note } = body as { note?: string };
  const today = new Date().toISOString().slice(0, 10);

  if (!tableReady) {
    try { await ensureTable(); tableReady = true; }
    catch { return NextResponse.json({ error: "DB error" }, { status: 500 }); }
  }

  const goals = await prisma.$queryRawUnsafe<{ checkInXP: number }[]>(
    `SELECT "checkInXP" FROM "Goal" WHERE id = $1 AND "userId" = $2 AND "dailyCheckIn" = true LIMIT 1`,
    goalId, session.user.id
  );
  if (goals.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const xp = Number(goals[0].checkInXP) || 5;

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "QuestCheckIn" WHERE "goalId" = $1 AND "userId" = $2 AND date = $3`,
    goalId, session.user.id, today
  );
  if (existing.length > 0) return NextResponse.json({ error: "Already checked in today" }, { status: 409 });

  const id = `qci_${Math.random().toString(36).slice(2, 11)}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "QuestCheckIn" (id, "goalId", "userId", date, note, "xpAwarded") VALUES ($1, $2, $3, $4, $5, $6)`,
    id, goalId, session.user.id, today, note ?? null, xp
  );

  await prisma.user.update({
    where: { id: session.user.id },
    data: { points: { increment: xp } },
  });

  return NextResponse.json({ id, date: today, xp });
}
