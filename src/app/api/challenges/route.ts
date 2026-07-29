import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dayRange, serverDayKey } from "@/lib/utils";

// 4 rotation groups, each shown for 14 days before cycling
const CHALLENGE_POOL = [
  // Group 0
  { id: "ch_g0_milestone", title: "Primo Passo",           description: "Completa almeno 1 milestone oggi",              xp: 15, type: "complete_milestone",    group: 0 },
  { id: "ch_g0_gym",       title: "Guerriero della Palestra", description: "Registra una sessione in palestra oggi",      xp: 25, type: "log_gym",               group: 0 },
  { id: "ch_g0_meals",     title: "Diario Alimentare",     description: "Registra almeno un pasto nella dieta oggi",      xp: 15, type: "complete_meals",         group: 0 },
  { id: "ch_g0_expense",   title: "Budget Tracker",        description: "Registra almeno 1 spesa oggi",                   xp: 10, type: "log_expense",            group: 0 },
  // Group 1
  { id: "ch_g1_miles3",    title: "Tre Conquiste",         description: "Completa 3 milestone oggi",                      xp: 30, type: "complete_3_milestones",  group: 1 },
  { id: "ch_g1_gym",       title: "Sessione Intensa",      description: "Registra una sessione in palestra oggi",          xp: 25, type: "log_gym",               group: 1 },
  { id: "ch_g1_meals",     title: "Nutri il Corpo",        description: "Registra almeno un pasto nella dieta oggi",      xp: 15, type: "complete_meals",         group: 1 },
  { id: "ch_g1_shopping",  title: "Cacciatore di Provviste", description: "Spunta almeno 3 prodotti dalla lista spesa",   xp: 10, type: "check_shopping",         group: 1 },
  // Group 2
  { id: "ch_g2_milestone", title: "Avanzamento",           description: "Completa almeno 1 milestone oggi",              xp: 15, type: "complete_milestone",    group: 2 },
  { id: "ch_g2_gym",       title: "Corpo in Forma",        description: "Registra una sessione in palestra oggi",          xp: 25, type: "log_gym",               group: 2 },
  { id: "ch_g2_meals",     title: "Pasto Tracciato",       description: "Registra almeno un pasto nella dieta oggi",      xp: 15, type: "complete_meals",         group: 2 },
  { id: "ch_g2_quest",     title: "Missione Completata",   description: "Completa una missione oggi",                     xp: 40, type: "complete_quest",         group: 2 },
  // Group 3
  { id: "ch_g3_checkin",   title: "Impegno Costante",      description: "Fai il check-in giornaliero su una missione",    xp: 15, type: "daily_checkin",          group: 3 },
  { id: "ch_g3_gym",       title: "Allenamento del Giorno", description: "Registra una sessione in palestra oggi",        xp: 25, type: "log_gym",               group: 3 },
  { id: "ch_g3_meals",     title: "Cibo Consapevole",      description: "Registra almeno un pasto nella dieta oggi",      xp: 15, type: "complete_meals",         group: 3 },
  { id: "ch_g3_weight",    title: "Iron Scale",            description: "Registra il tuo peso oggi",                      xp: 10, type: "log_weight",             group: 3 },
];

const CURRENT_IDS = CHALLENGE_POOL.map(c => c.id);

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DailyChallenge" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "xp" INTEGER NOT NULL DEFAULT 10,
      "type" TEXT NOT NULL,
      "group" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "DailyChallenge" ADD COLUMN IF NOT EXISTS "group" INTEGER NOT NULL DEFAULT 0`);
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
  // Remove stale challenges
  const fixedIds = CURRENT_IDS.map(id => `'${id}'`).join(",");
  await prisma.$executeRawUnsafe(`DELETE FROM "DailyChallenge" WHERE id NOT IN (${fixedIds})`);
  // Upsert all challenges
  for (const ch of CHALLENGE_POOL) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DailyChallenge" ("id","title","description","xp","type","group") VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ("id") DO UPDATE SET "title"=$2,"description"=$3,"xp"=$4,"type"=$5,"group"=$6`,
      ch.id, ch.title, ch.description, ch.xp, ch.type, ch.group
    );
  }
}

let tablesReady = false;

// Rotation: every 14 days, advance to next group (0→1→2→3→0)
function currentGroup(): number {
  return Math.floor(Math.floor(Date.now() / 86400000) / 14) % 4;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const today = serverDayKey();

  if (!tablesReady) {
    try {
      await ensureTables();
      tablesReady = true;
    } catch {
      return NextResponse.json([]);
    }
  }

  const group = currentGroup();
  const challenges = await prisma.$queryRawUnsafe<{ id: string; title: string; description: string; xp: number; type: string }[]>(
    `SELECT id, title, description, xp, type FROM "DailyChallenge" WHERE "group" = $1 ORDER BY xp ASC`,
    group
  );

  if (challenges.length === 0) return NextResponse.json([]);

  const completions = await prisma.$queryRawUnsafe<{ challengeId: string; completed: boolean }[]>(
    `SELECT "challengeId", "completed" FROM "UserDailyChallenge" WHERE "userId" = $1 AND "date" = $2`,
    userId, today
  );

  const now = new Date();
  const { start: dayStart, end: dayEnd } = dayRange(now);

  let conditionMap: Record<string, boolean> = {};

  try {
    const [milestoneCount, expenseCount, milestones3, completedQuestCount, weightCount] = await Promise.all([
      prisma.milestone.count({ where: { goal: { userId }, completed: true, completedAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.expense.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.milestone.count({ where: { goal: { userId }, completed: true, completedAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.goal.count({ where: { userId, status: "completed", completedAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.weightEntry.count({ where: { userId, createdAt: { gte: dayStart, lt: dayEnd } } }),
    ]);

    const questCheckin = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "QuestCheckIn" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]);

    const gymCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "GymLog" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]);

    // Il diario alimentare (FoodEntry) è l'unica fonte: il piano del
    // nutrizionista e le sue MealCompletion non esistono più.
    const mealCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "FoodEntry" WHERE "userId" = $1 AND date = $2`,
      userId, today
    ).catch(() => [{ count: BigInt(0) }]);

    const shoppingChecked = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "ShoppingItem"
       WHERE "userId" = $1 AND "checked" = true AND "checkedAt" >= $2 AND "checkedAt" < $3`,
      userId, dayStart, dayEnd
    ).catch(() => [{ count: BigInt(0) }]);

    conditionMap = {
      complete_milestone:    milestoneCount >= 1,
      log_expense:           expenseCount >= 1,
      complete_3_milestones: milestones3 >= 3,
      complete_quest:        completedQuestCount >= 1,
      log_weight:            weightCount >= 1,
      daily_checkin:         Number(questCheckin[0]?.count ?? 0) >= 1,
      log_gym:               Number(gymCount[0]?.count ?? 0) >= 1,
      complete_meals:        Number(mealCount[0]?.count ?? 0) >= 1,
      check_shopping:        Number(shoppingChecked[0]?.count ?? 0) >= 3,
    };
  } catch { /* challenges show as locked if condition checks fail */ }

  const result = challenges.map(c => ({
    ...c,
    completed: completions.find(co => co.challengeId === c.id)?.completed ?? false,
    conditionMet: conditionMap[c.type] ?? false,
  }));

  return NextResponse.json(result);
}
