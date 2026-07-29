// Il Boss della settimana.
//
// Le sfide giornaliere chiedono un gesto e si esauriscono in un giorno. Il
// Boss chiede tre cose diverse nell'arco di sette giorni: non lo si abbatte
// per caso, e non lo si recupera l'ultima sera. È il pezzo che dà un arco
// più lungo del quotidiano senza inventare una valuta nuova — paga in XP e
// in punti-stat, cioè nelle due monete che l'app già conosce.
//
// Modulo puro e client-safe: qui vivono il calendario, il bestiario e il
// conteggio dei progressi. Le query stanno in boss-server.ts.

import type { StatKey } from "./hero-stats";

/** Cosa va misurato per una condizione. Ogni chiave ha la sua query. */
export type BossMetric =
  | "milestones"      // milestone completate nella settimana
  | "quests"          // missioni portate a termine
  | "checkins"        // check-in giornalieri su missioni
  | "gym"             // sessioni di palestra registrate
  | "steps"           // passi totali dal braccialetto
  | "sleepNights"     // notti con almeno 7 ore
  | "habitDays"       // giorni con almeno un'abitudine spuntata
  | "expenseDays"     // giorni in cui hai registrato almeno una spesa
  | "mealDays";       // giorni con almeno un pasto nel diario

export type BossCondition = {
  metric: BossMetric;
  target: number;
  label: string;
};

export type Boss = {
  id: string;
  name: string;
  icon: string;
  /** Una riga di sapore: il boss deve sembrare un avversario, non una lista. */
  taunt: string;
  conditions: BossCondition[];
  xp: number;
  /** Punti-stat della vittoria, distribuiti sulle statistiche che ha allenato. */
  stats: { stat: StatKey; points: number }[];
};

/**
 * Quattro boss in rotazione settimanale. Ognuno chiede tre cose di natura
 * diversa — corpo, costanza, testa — così nessuno si vince restando bravo
 * in una cosa sola.
 */
export const BOSSES: Boss[] = [
  {
    id: "boss_sedentario",
    name: "Il Sedentario",
    icon: "🛋️",
    taunt: "Ti sussurra che il divano è comodo e che domani è un altro giorno.",
    conditions: [
      { metric: "gym", target: 3, label: "allenamenti in palestra" },
      { metric: "steps", target: 50000, label: "passi nella settimana" },
      { metric: "habitDays", target: 5, label: "giorni con un'abitudine spuntata" },
    ],
    xp: 100,
    stats: [
      { stat: "for", points: 15 },
      { stat: "cos", points: 15 },
    ],
  },
  {
    id: "boss_tentatore",
    name: "Il Tentatore del Portafoglio",
    icon: "🪙",
    taunt: "Ogni notifica di sconto è una sua freccia. Contale, e non ti colpiranno.",
    conditions: [
      { metric: "expenseDays", target: 5, label: "giorni con le spese annotate" },
      { metric: "milestones", target: 5, label: "milestone completate" },
      { metric: "checkins", target: 4, label: "check-in giornalieri" },
    ],
    xp: 100,
    stats: [
      { stat: "oro", points: 20 },
      { stat: "sag", points: 10 },
    ],
  },
  {
    id: "boss_procrastinatore",
    name: "Il Procrastinatore",
    icon: "⏳",
    taunt: "Non ti ferma: ti convince soltanto che c'è tempo. Smentiscilo.",
    conditions: [
      { metric: "milestones", target: 10, label: "milestone completate" },
      { metric: "quests", target: 1, label: "missione portata a termine" },
      { metric: "checkins", target: 5, label: "check-in giornalieri" },
    ],
    xp: 120,
    stats: [
      { stat: "sag", points: 15 },
      { stat: "int", points: 15 },
    ],
  },
  {
    id: "boss_nottambulo",
    name: "Il Nottambulo",
    icon: "🌙",
    taunt: "Ti tiene sveglio promettendo un ultimo episodio. Il braccialetto lo sa.",
    conditions: [
      { metric: "sleepNights", target: 5, label: "notti da almeno 7 ore" },
      { metric: "mealDays", target: 5, label: "giorni con i pasti registrati" },
      { metric: "gym", target: 2, label: "allenamenti in palestra" },
    ],
    xp: 100,
    stats: [
      { stat: "cos", points: 20 },
      { stat: "sag", points: 10 },
    ],
  },
];

/** Notti che contano come riposo vero, in minuti. */
export const GOOD_NIGHT_MINUTES = 7 * 60;

/**
 * Chiave della settimana ISO ("2026-W31"): identifica la sfida in corso e
 * impedisce di riscuotere due volte lo stesso boss.
 */
export function weekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO: la settimana appartiene all'anno del suo giovedì.
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Il boss di questa settimana: rotazione fissa, uguale per tutti. */
export function bossForWeek(date: Date = new Date()): Boss {
  const [year, w] = weekKey(date).split("-W");
  const index = (Number(year) * 53 + Number(w)) % BOSSES.length;
  return BOSSES[index];
}

export type BossProgress = {
  boss: Boss;
  week: string;
  conditions: { condition: BossCondition; current: number; done: boolean }[];
  /** 0-100, media dei progressi: una barra sola per l'intera impresa. */
  percent: number;
  defeated: boolean;
  claimed: boolean;
};

/** Quanto manca, condizione per condizione. */
export function buildProgress(
  boss: Boss,
  week: string,
  values: Partial<Record<BossMetric, number>>,
  claimed: boolean
): BossProgress {
  const conditions = boss.conditions.map((condition) => {
    // `Math.max(0, NaN)` resta NaN: un valore non numerico deve valere zero,
    // altrimenti una query andata storta propaga NaN fino alla barra.
    const raw = Number(values[condition.metric]);
    const current = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    return { condition, current, done: current >= condition.target };
  });

  const percent = Math.round(
    (conditions.reduce((sum, c) => sum + Math.min(1, c.current / c.condition.target), 0) /
      conditions.length) * 100
  );

  return {
    boss,
    week,
    conditions,
    percent,
    defeated: conditions.every((c) => c.done),
    claimed,
  };
}

/** "1.250 / 50.000 passi" — i numeri grossi vanno letti a colpo d'occhio. */
export function formatBossValue(metric: BossMetric, value: number): string {
  return metric === "steps" ? Math.round(value).toLocaleString("it-IT") : String(Math.round(value));
}
