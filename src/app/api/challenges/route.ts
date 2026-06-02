import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const today = new Date().toISOString().slice(0, 10);

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

  // Check all conditions in parallel
  const [milestoneCount, expenseCount, habits, weightCount, mealCount] = await Promise.all([
    prisma.milestone.count({ where: { goal: { userId }, completed: true, completedAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.expense.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.habit.findMany({ where: { userId }, include: { logs: { where: { date: today } } } }),
    prisma.weightEntry.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.mealLog.count({ where: { userId, date: today } }),
  ]);

  const allHabitsDone = habits.length > 0 && habits.every((h) => h.logs.length > 0);

  const conditionMap: Record<string, boolean> = {
    complete_milestone: milestoneCount >= 1,
    log_expense: expenseCount >= 1,
    check_habit: allHabitsDone,
    log_weight: weightCount >= 1,
    log_meal: mealCount >= 1,
  };

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
