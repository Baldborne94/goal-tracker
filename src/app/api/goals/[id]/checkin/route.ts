import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { statPointsFromXp } from "@/lib/hero-stats";
import { awardStat } from "@/lib/hero-stats-server";

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

  const goals = await prisma.$queryRawUnsafe<{ checkInXP: number; createdAt: Date; targetDate: Date | null; checkInDays: string | null }[]>(
    `SELECT "checkInXP", "createdAt", "targetDate", "checkInDays" FROM "Goal" WHERE id = $1 AND "userId" = $2 AND "dailyCheckIn" = true LIMIT 1`,
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

  await awardStat(session.user.id, "sag", statPointsFromXp(xp), "quest_checkin", "Check-in giornaliero della missione");
  await prisma.user.update({
    where: { id: session.user.id },
    data: { points: { increment: xp } },
  });

  // Update progress for milestone-less quests
  let newProgress: number | undefined;
  const milestoneCount = await prisma.milestone.count({ where: { goalId } });
  if (milestoneCount === 0) {
    const { createdAt, targetDate, checkInDays: scheduleDays } = goals[0];
    const endDate = targetDate ? new Date(targetDate) : new Date(new Date(createdAt).getTime() + 90 * 86400000);
    const scheduledDays = scheduleDays ? scheduleDays.split(",").map(Number) : [0, 1, 2, 3, 4, 5, 6];

    // Count expected check-ins from createdAt to today (inclusive), capped at endDate
    let expected = 0;
    const cursor = new Date(createdAt);
    cursor.setHours(0, 0, 0, 0);
    const todayDate = new Date(today + "T00:00:00");
    const limitDate = todayDate < endDate ? todayDate : endDate;
    while (cursor <= limitDate) {
      if (scheduledDays.includes(cursor.getDay())) expected++;
      cursor.setDate(cursor.getDate() + 1);
    }

    const counts = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "QuestCheckIn" WHERE "goalId" = $1 AND "userId" = $2`,
      goalId, session.user.id
    );
    const done = Number(counts[0]?.count ?? 1);
    newProgress = expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : 0;
    await prisma.$executeRawUnsafe(`UPDATE "Goal" SET progress = $1 WHERE id = $2`, newProgress, goalId);
  }

  return NextResponse.json({ id, date: today, xp, ...(newProgress !== undefined && { progress: newProgress }) });
}
