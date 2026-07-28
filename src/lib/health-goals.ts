import { prisma } from "./db";
import { getMetric } from "./health";

// Collega i dati del braccialetto alle missioni: una quest con
// `healthMetric` + `healthTarget` (es. passi ≥ 10000) si spunta da sola
// quando il totale del giorno raggiunge la soglia.

export type AutoCheckIn = {
  goalId: string;
  goalTitle: string;
  date: string;
  value: number;
  target: number;
  xp: number;
};

type HealthGoal = {
  id: string;
  title: string;
  healthMetric: string;
  healthTarget: number;
  checkInXP: number;
};

/**
 * Valore della giornata secondo la modalità dichiarata nel registro.
 * "last" non è un'aggregazione SQL: è il campione più recente del giorno.
 */
async function dailyTotal(userId: string, metricType: string, date: string): Promise<number> {
  const mode = getMetric(metricType)?.aggregation ?? "sum";

  if (mode === "last") {
    const rows = await prisma.$queryRawUnsafe<{ value: number }[]>(
      `SELECT value FROM "HealthMetric"
       WHERE "userId" = $1 AND "metricType" = $2 AND date = $3
       ORDER BY "recordedAt" DESC LIMIT 1`,
      userId, metricType, date
    );
    return Number(rows[0]?.value ?? 0);
  }

  const fn = mode === "avg" ? "AVG" : mode === "max" ? "MAX" : "SUM";
  const rows = await prisma.$queryRawUnsafe<{ total: number | null }[]>(
    `SELECT ${fn}(value) AS total FROM "HealthMetric"
     WHERE "userId" = $1 AND "metricType" = $2 AND date = $3`,
    userId, metricType, date
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Per ogni giornata toccata dal sync, spunta le quest la cui metrica ha
 * raggiunto la soglia. Idempotente: il vincolo UNIQUE su
 * (goalId, userId, date) impedisce doppi check-in e quindi XP doppi.
 */
export async function applyHealthGoals(userId: string, dates: string[]): Promise<AutoCheckIn[]> {
  if (dates.length === 0) return [];

  const goals = await prisma.$queryRawUnsafe<HealthGoal[]>(
    `SELECT id, title, "healthMetric", "healthTarget", COALESCE("checkInXP", 5) AS "checkInXP"
     FROM "Goal"
     WHERE "userId" = $1 AND status = 'active'
       AND "healthMetric" IS NOT NULL AND "healthTarget" IS NOT NULL`,
    userId
  );
  if (goals.length === 0) return [];

  const awarded: AutoCheckIn[] = [];

  for (const goal of goals) {
    const target = Number(goal.healthTarget);
    if (!Number.isFinite(target) || target <= 0) continue;

    for (const date of dates) {
      const value = await dailyTotal(userId, goal.healthMetric, date);
      if (value < target) continue;

      const xp = Number(goal.checkInXP) || 5;
      const id = `qci_${Math.random().toString(36).slice(2, 11)}`;
      const inserted = await prisma.$executeRawUnsafe(
        `INSERT INTO "QuestCheckIn" (id, "goalId", "userId", date, note, "xpAwarded")
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("goalId", "userId", date) DO NOTHING`,
        id, goal.id, userId, date, "Completata automaticamente dai dati del braccialetto", xp
      );

      // 0 righe = check-in già presente per quel giorno: niente XP.
      if (inserted === 0) continue;

      await prisma.user.update({
        where: { id: userId },
        data: { points: { increment: xp } },
      });

      awarded.push({ goalId: goal.id, goalTitle: goal.title, date, value, target, xp });
    }
  }

  return awarded;
}
