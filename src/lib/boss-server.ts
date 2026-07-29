// Lato server del Boss della settimana: misura i progressi e assegna la
// vittoria. Le regole e il bestiario stanno in boss.ts.

import { prisma } from "./db";
import { initBossTable } from "./init-tables";
import { awardStat } from "./hero-stats-server";
import { dayRange, serverDayKey } from "./utils";
import {
  BOSSES,
  GOOD_NIGHT_MINUTES,
  bossForWeek,
  buildProgress,
  weekKey,
  type BossMetric,
  type BossProgress,
} from "./boss";

/** Lunedì e domenica della settimana in corso, come chiavi "YYYY-MM-DD". */
function weekBounds(now: Date = new Date()): { fromKey: string; from: Date; to: Date } {
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
  const { start: from } = dayRange(monday);
  const to = new Date(from.getTime() + 7 * 86400000);
  return { fromKey: serverDayKey(monday), from, to };
}

/**
 * Misura tutte e nove le metriche possibili in una volta sola. Sono query
 * leggere e la schermata ne mostra tre: farne nove qui costa meno che
 * ramificare, e permette di cambiare bestiario senza toccare il conteggio.
 */
async function measureWeek(userId: string, now: Date): Promise<Record<BossMetric, number>> {
  const { fromKey, from, to } = weekBounds(now);
  const zero = { count: BigInt(0) };

  const [milestones, quests, checkins, gym, steps, sleepNights, habitDays, expenseDays, mealDays] =
    await Promise.all([
      prisma.milestone.count({
        where: { goal: { userId }, completed: true, completedAt: { gte: from, lt: to } },
      }).catch(() => 0),
      prisma.goal.count({
        where: { userId, status: "completed", completedAt: { gte: from, lt: to } },
      }).catch(() => 0),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM "QuestCheckIn" WHERE "userId" = $1 AND date >= $2`,
        userId, fromKey
      ).catch(() => [zero]),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM "GymLog" WHERE "userId" = $1 AND date >= $2`,
        userId, fromKey
      ).catch(() => [zero]),
      prisma.$queryRawUnsafe<{ total: number | null }[]>(
        `SELECT SUM(value) as total FROM "HealthMetric"
         WHERE "userId" = $1 AND "metricType" = 'steps' AND date >= $2`,
        userId, fromKey
      ).catch(() => [{ total: 0 }]),
      // Una notte conta se il totale dei suoi campioni supera la soglia.
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*) as count FROM (
           SELECT date FROM "HealthMetric"
           WHERE "userId" = $1 AND "metricType" = 'sleep' AND date >= $2
           GROUP BY date HAVING SUM(value) >= $3
         ) nights`,
        userId, fromKey, GOOD_NIGHT_MINUTES
      ).catch(() => [zero]),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(DISTINCT hl.date) as count
         FROM "HabitLog" hl JOIN "Habit" h ON h.id = hl."habitId"
         WHERE h."userId" = $1 AND hl.date >= $2`,
        userId, fromKey
      ).catch(() => [zero]),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(DISTINCT DATE("createdAt")) as count FROM "Expense"
         WHERE "userId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3`,
        userId, from, to
      ).catch(() => [zero]),
      prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(DISTINCT date) as count FROM "FoodEntry"
         WHERE "userId" = $1 AND date >= $2`,
        userId, fromKey
      ).catch(() => [zero]),
    ]);

  const n = (rows: { count: bigint }[]) => Number(rows[0]?.count ?? 0);

  return {
    milestones,
    quests,
    checkins: n(checkins),
    gym: n(gym),
    steps: Number(steps[0]?.total ?? 0),
    sleepNights: n(sleepNights),
    habitDays: n(habitDays),
    expenseDays: n(expenseDays),
    mealDays: n(mealDays),
  };
}

async function isClaimed(userId: string, week: string, bossId: string): Promise<boolean> {
  try {
    await initBossTable();
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "BossDefeat" WHERE "userId" = $1 AND week = $2 AND "bossId" = $3`,
      userId, week, bossId
    );
    return Number(rows[0]?.count ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function getBossProgress(userId: string, now: Date = new Date()): Promise<BossProgress> {
  const boss = bossForWeek(now);
  const week = weekKey(now);
  const [values, claimed] = await Promise.all([
    measureWeek(userId, now),
    isClaimed(userId, week, boss.id),
  ]);
  return buildProgress(boss, week, values, claimed);
}

export type BossClaimResult =
  | { ok: true; xp: number; bossName: string }
  | { ok: false; reason: "not_defeated" | "already_claimed" | "error" };

/**
 * Riscuote la vittoria. L'inserimento in BossDefeat è protetto da un vincolo
 * di unicità su (userId, week, bossId): due tocchi ravvicinati non possono
 * pagare due volte, chi arriva secondo trova la riga già lì.
 */
export async function claimBoss(userId: string, now: Date = new Date()): Promise<BossClaimResult> {
  const progress = await getBossProgress(userId, now);
  if (progress.claimed) return { ok: false, reason: "already_claimed" };
  if (!progress.defeated) return { ok: false, reason: "not_defeated" };

  const { boss, week } = progress;

  try {
    await initBossTable();
    const id = `bd_${Math.random().toString(36).slice(2, 11)}`;
    const inserted = await prisma.$executeRawUnsafe(
      `INSERT INTO "BossDefeat" ("id","userId","week","bossId","xpAwarded")
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("userId","week","bossId") DO NOTHING`,
      id, userId, week, boss.id, boss.xp
    );
    if (inserted === 0) return { ok: false, reason: "already_claimed" };
  } catch {
    return { ok: false, reason: "error" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { points: { increment: boss.xp } },
  });

  for (const reward of boss.stats) {
    await awardStat(userId, reward.stat, reward.points, "boss", `${boss.name} abbattuto`);
  }

  return { ok: true, xp: boss.xp, bossName: boss.name };
}

/** Quanti boss sono stati abbattuti in tutto: va nella scheda dell'Eroe. */
export async function countBossDefeats(userId: string): Promise<number> {
  try {
    await initBossTable();
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "BossDefeat" WHERE "userId" = $1`,
      userId
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export { BOSSES };
