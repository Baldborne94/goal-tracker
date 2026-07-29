import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id: challengeId } = await params;
  const today = new Date().toISOString().slice(0, 10);

  const challenges = await prisma.$queryRawUnsafe<{ id: string; xp: number; type: string }[]>(
    `SELECT id, xp, type FROM "DailyChallenge" WHERE id = $1 LIMIT 1`,
    challengeId
  );
  if (challenges.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const challenge = challenges[0];

  const existing = await prisma.$queryRawUnsafe<{ completed: boolean }[]>(
    `SELECT completed FROM "UserDailyChallenge" WHERE "userId" = $1 AND "challengeId" = $2 AND "date" = $3 LIMIT 1`,
    userId, challengeId, today
  );
  if (existing[0]?.completed) return NextResponse.json({ error: "Already claimed" }, { status: 400 });

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  let conditionMet = false;

  if (challenge.type === "complete_milestone") {
    const count = await prisma.milestone.count({ where: { goal: { userId }, completed: true, completedAt: { gte: dayStart, lt: dayEnd } } });
    conditionMet = count >= 1;
  } else if (challenge.type === "log_expense") {
    const count = await prisma.expense.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } });
    conditionMet = count >= 1;
  } else if (challenge.type === "complete_3_milestones") {
    const count = await prisma.milestone.count({ where: { goal: { userId }, completed: true, completedAt: { gte: dayStart, lt: dayEnd } } });
    conditionMet = count >= 3;
  } else if (challenge.type === "complete_quest") {
    const count = await prisma.goal.count({ where: { userId, status: "completed", completedAt: { gte: dayStart, lt: dayEnd } } });
    conditionMet = count >= 1;
  } else if (challenge.type === "log_weight") {
    const count = await prisma.weightEntry.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } });
    conditionMet = count >= 1;
  } else if (challenge.type === "daily_checkin") {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "QuestCheckIn" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]);
    conditionMet = Number(rows[0]?.count ?? 0) >= 1;
  } else if (challenge.type === "log_gym") {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "GymLog" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]);
    conditionMet = Number(rows[0]?.count ?? 0) >= 1;
  } else if (challenge.type === "complete_meals") {
    // Conta solo il diario alimentare: il piano del nutrizionista e le sue
    // MealCompletion non esistono più.
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "FoodEntry" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]);
    conditionMet = Number(rows[0]?.count ?? 0) >= 1;
  } else if (challenge.type === "check_shopping") {
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "ShoppingItem" WHERE "userId" = $1 AND "checked" = true`,
      userId
    ).catch(() => [{ count: BigInt(0) }]);
    conditionMet = Number(rows[0]?.count ?? 0) >= 3;
  }

  if (!conditionMet) return NextResponse.json({ error: "Condition not met" }, { status: 400 });

  const id = `udc_${Math.random().toString(36).slice(2, 11)}`;
  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "UserDailyChallenge" SET "completed" = true, "completedAt" = NOW() WHERE "userId" = $1 AND "challengeId" = $2 AND "date" = $3`,
      userId, challengeId, today
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "UserDailyChallenge" ("id","userId","challengeId","date","completed","completedAt") VALUES ($1,$2,$3,$4,true,NOW())`,
      id, userId, challengeId, today
    );
  }

  await prisma.user.update({ where: { id: userId }, data: { points: { increment: challenge.xp } } });

  return NextResponse.json({ ok: true, xp: challenge.xp });
}
