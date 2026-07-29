// Lato server della Scheda dell'Eroe: il ledger StatEvent e gli award.
// Le regole (mappe, curva dei punteggi, classe) stanno in hero-stats.ts.

import { prisma } from "./db";
import { serverDayKey } from "./utils";
import { initStatEventTable } from "./init-tables";
import { BASE_SCORE, EMPTY_TOTALS, STAT_BY_KEY, scoreFromPoints, type StatKey, type StatTotals } from "./hero-stats";

export type StatEventRow = {
  id: string;
  stat: StatKey;
  points: number;
  source: string;
  label: string;
  date: string;
  /** Punteggio 8-20 dopo l'evento; null sulle righe scritte prima di questa colonna. */
  scoreAfter: number | null;
  /** True se proprio qui la statistica è salita di gradino. */
  leveledUp: boolean;
  createdAt: string | Date;
};

/** Punteggi che meritano un trofeo: il talento, la maestria, la leggenda. */
const TROPHY_SCORES: Record<number, string> = {
  12: "Talento",
  16: "Maestria",
  20: "Leggenda",
};

/**
 * Scrive una riga nel registro. Non lancia MAI: la scheda è un livello di
 * gioco sopra le funzioni vere, e un suo inciampo non deve far fallire il
 * salvataggio di un allenamento o di una spesa. Chi chiama non deve
 * nemmeno ricordarsi il catch.
 *
 * Segna anche `scoreAfter`, il punteggio raggiunto: quando è più alto di
 * quello di prima, quella riga è il momento in cui la statistica è salita
 * di gradino — e la scheda può mostrarlo invece di far cambiare un numero
 * in silenzio.
 */
export async function awardStat(
  userId: string,
  stat: StatKey,
  points: number,
  source: string,
  label: string
): Promise<void> {
  const pts = Math.round(Number(points) || 0);
  if (pts <= 0) return;

  try {
    await initStatEventTable();

    const before = await prisma.$queryRawUnsafe<{ total: bigint | number | null }[]>(
      `SELECT SUM(points) as total FROM "StatEvent" WHERE "userId" = $1 AND stat = $2`,
      userId, stat
    );
    const totalBefore = Number(before[0]?.total ?? 0);
    const scoreBefore = scoreFromPoints(totalBefore).score;
    const scoreAfter = scoreFromPoints(totalBefore + pts).score;

    const id = `se_${Math.random().toString(36).slice(2, 11)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "StatEvent" ("id","userId","stat","points","source","label","date","scoreAfter")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      id, userId, stat, pts, source, label.slice(0, 120), serverDayKey(), scoreAfter
    );

    if (scoreAfter > scoreBefore) await awardStatTrophies(userId, stat, scoreBefore, scoreAfter);
  } catch {
    // il registro riprova al prossimo evento; il gesto vero è già salvato
  }
}

/**
 * Trofei per i gradini importanti. Il ciclo copre anche il salto di più
 * gradini in un colpo solo (una vittoria sul boss può valerne due).
 */
async function awardStatTrophies(userId: string, stat: StatKey, from: number, to: number) {
  const def = STAT_BY_KEY.get(stat);
  if (!def) return;

  for (let score = from + 1; score <= to; score++) {
    const tier = TROPHY_SCORES[score];
    if (!tier) continue;

    const name = `${def.label} ${score}`;
    try {
      let reward = await prisma.reward.findUnique({ where: { name } });
      if (!reward) {
        reward = await prisma.reward.create({
          data: {
            name,
            description: `${tier}: ${def.label} a ${score}`,
            icon: def.icon,
            type: "badge",
          },
        });
      }
      const already = await prisma.userReward.findFirst({ where: { userId, rewardId: reward.id } });
      if (!already) await prisma.userReward.create({ data: { userId, rewardId: reward.id } });
    } catch {
      // un trofeo mancato non deve fermare il punto guadagnato
    }
  }
}

/** Totali per statistica, base della scheda. */
export async function getStatTotals(userId: string): Promise<StatTotals> {
  try {
    await initStatEventTable();
    const rows = await prisma.$queryRawUnsafe<{ stat: string; total: bigint | number }[]>(
      `SELECT stat, SUM(points) as total FROM "StatEvent" WHERE "userId" = $1 GROUP BY stat`,
      userId
    );
    const totals: StatTotals = { ...EMPTY_TOTALS };
    for (const r of rows) {
      if (r.stat in totals) totals[r.stat as StatKey] = Number(r.total) || 0;
    }
    return totals;
  } catch {
    return { ...EMPTY_TOTALS };
  }
}

/** Le ultime righe del registro, per la sezione «Registro» della scheda. */
export async function getRecentStatEvents(userId: string, limit = 12): Promise<StatEventRow[]> {
  try {
    await initStatEventTable();
    // LAG guarda l'evento precedente della stessa statistica: se il punteggio
    // è cresciuto, quella riga è il momento del gradino. La finestra è
    // calcolata su tutte le righe dell'utente, prima del LIMIT, quindi il
    // confronto resta giusto anche sulla riga più vecchia mostrata.
    return await prisma.$queryRawUnsafe<StatEventRow[]>(
      `SELECT id, stat, points, source, label, date, "scoreAfter", "createdAt",
              COALESCE("scoreAfter", 0) > COALESCE(
                LAG("scoreAfter") OVER (PARTITION BY stat ORDER BY "createdAt"), $3
              ) AS "leveledUp"
       FROM "StatEvent" WHERE "userId" = $1
       ORDER BY "createdAt" DESC LIMIT $2`,
      userId, Math.min(50, Math.max(1, limit)), BASE_SCORE
    );
  } catch {
    return [];
  }
}
