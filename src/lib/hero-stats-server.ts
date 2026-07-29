// Lato server della Scheda dell'Eroe: il ledger StatEvent e gli award.
// Le regole (mappe, curva dei punteggi, classe) stanno in hero-stats.ts.

import { prisma } from "./db";
import { initStatEventTable } from "./init-tables";
import { EMPTY_TOTALS, type StatKey, type StatTotals } from "./hero-stats";

export type StatEventRow = {
  id: string;
  stat: StatKey;
  points: number;
  source: string;
  label: string;
  date: string;
  createdAt: string | Date;
};

/**
 * Scrive una riga nel registro. Non lancia MAI: la scheda è un livello di
 * gioco sopra le funzioni vere, e un suo inciampo non deve far fallire il
 * salvataggio di un allenamento o di una spesa. Chi chiama non deve
 * nemmeno ricordarsi il catch.
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
    const id = `se_${Math.random().toString(36).slice(2, 11)}`;
    const date = new Date().toISOString().slice(0, 10);
    await prisma.$executeRawUnsafe(
      `INSERT INTO "StatEvent" ("id","userId","stat","points","source","label","date")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      id, userId, stat, pts, source, label.slice(0, 120), date
    );
  } catch {
    // il registro riprova al prossimo evento; il gesto vero è già salvato
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
    return await prisma.$queryRawUnsafe<StatEventRow[]>(
      `SELECT id, stat, points, source, label, date, "createdAt"
       FROM "StatEvent" WHERE "userId" = $1
       ORDER BY "createdAt" DESC LIMIT $2`,
      userId, Math.min(50, Math.max(1, limit))
    );
  } catch {
    return [];
  }
}
