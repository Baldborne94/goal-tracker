import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_CHALLENGES = [
  { id: "ch_milestone", title: "Early Bird",     description: "Complete at least 1 milestone today", xp: 15, type: "complete_milestone" },
  { id: "ch_expense",   title: "Budget Tracker", description: "Log at least 1 expense today",        xp: 10, type: "log_expense" },
  { id: "ch_habit",     title: "Habit Warrior",  description: "Complete all your habits today",      xp: 20, type: "check_habit" },
  { id: "ch_weight",    title: "Iron Scale",     description: "Log your weight today",               xp: 10, type: "log_weight" },
  { id: "ch_meal",      title: "Mindful Eater",  description: "Log a meal today",                    xp: 10, type: "log_meal" },
];

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyChallenge" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "xp" INTEGER NOT NULL DEFAULT 10,
      "type" TEXT NOT NULL,
      CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserDailyChallenge" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "challengeId" TEXT NOT NULL,
      "date" TEXT NOT NULL,
      "completed" BOOLEAN NOT NULL DEFAULT false,
      "completedAt" TIMESTAMP(3),
      CONSTRAINT "UserDailyChallenge_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "UserDailyChallenge_userId_challengeId_date_key" UNIQUE ("userId", "challengeId", "date"),
      CONSTRAINT "UserDailyChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "UserDailyChallenge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "DailyChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  for (const ch of DEFAULT_CHALLENGES) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DailyChallenge" ("id","title","description","xp","type") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("id") DO NOTHING`,
      ch.id, ch.title, ch.description, ch.xp, ch.type
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const today = new Date().toISOString().slice(0, 10);

  // Ensure tables exist and challenges are seeded (idempotent, safe on every call)
  try {
    await ensureTables();
  } catch {
    return NextResponse.json([]);
  }

  const challenges = await prisma.$queryRawUnsafe<{ id: string; title: string; description: string; xp: number; type: string }[]>(
    `SELECT id, title, description, xp, type FROM "DailyChallenge" ORDER BY xp ASC`
  );

  if (challenges.length === 0) return NextResponse.json([]);

  const completions = await prisma.$queryRawUnsafe<{ challengeId: string; completed: boolean }[]>(
    `SELECT "challengeId", "completed" FROM "UserDailyChallenge" WHERE "userId" = $1 AND "date" = $2`,
    userId, today
  );

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  let conditionMap: Record<string, boolean> = {
    complete_milestone: false,
    log_expense: false,
    check_habit: false,
    log_weight: false,
    log_meal: false,
  };

  try {
    const [milestoneCount, expenseCount, habits, weightCount, mealCount] = await Promise.all([
      prisma.milestone.count({ where: { goal: { userId }, completed: true, completedAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.expense.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.habit.findMany({ where: { userId }, include: { logs: { where: { date: today } } } }),
      prisma.weightEntry.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.mealLog.count({ where: { userId, date: today } }),
    ]);
    const allHabitsDone = habits.length > 0 && habits.every((h: { logs: unknown[] }) => h.logs.length > 0);
    conditionMap = {
      complete_milestone: milestoneCount >= 1,
      log_expense: expenseCount >= 1,
      check_habit: allHabitsDone,
      log_weight: weightCount >= 1,
      log_meal: mealCount >= 1,
    };
  } catch { /* challenges show as locked if condition checks fail */ }

  const result = challenges.map((c) => {
    const completion = completions.find((co) => co.challengeId === c.id);
    return {
      ...c,
      completed: completion?.completed ?? false,
      conditionMet: conditionMap[c.type] ?? false,
    };
  });

  return NextResponse.json(result);
}
