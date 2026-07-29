// La Scheda dell'Eroe: statistiche permanenti che crescono con le azioni
// vere. Si parte da 8 in tutto (il popolano di D&D) e si sale fino a 20;
// la classe non si sceglie, emerge dalla statistica dominante.
//
// Questo modulo è puro e client-safe: le regole del gioco vivono qui, il
// ledger (tabella StatEvent) e gli award vivono in hero-stats-server.ts.
// Gli XP non c'entrano: restano il binario del livello globale
// (Recruit → King); le stat sono l'altro binario, quello che dice chi sei.

export type StatKey = "for" | "cos" | "int" | "sag" | "oro";

export type StatDef = {
  key: StatKey;
  /** Sigla da scheda, tre lettere. */
  short: string;
  label: string;
  icon: string;
  /** Da dove arriva, spiegato all'utente. */
  hint: string;
};

export const STATS: StatDef[] = [
  { key: "for", short: "FOR", label: "Forza",        icon: "⚔️", hint: "palestra e missioni di allenamento" },
  { key: "cos", short: "COS", label: "Costituzione", icon: "🛡️", hint: "passi, sonno, peso e pasti tracciati" },
  { key: "int", short: "INT", label: "Intelligenza", icon: "📖", hint: "studio, lettura e creatività" },
  { key: "sag", short: "SAG", label: "Saggezza",     icon: "🧘", hint: "abitudini, check-in e costanza" },
  { key: "oro", short: "ORO", label: "Ricchezza",    icon: "💰", hint: "spese tracciate e mesi sotto budget" },
];

export const STAT_BY_KEY = new Map(STATS.map((s) => [s.key, s]));

export type StatTotals = Record<StatKey, number>;

export const EMPTY_TOTALS: StatTotals = { for: 0, cos: 0, int: 0, sag: 0, oro: 0 };

/**
 * Da nome categoria della missione a statistica. Le categorie sono libere
 * (l'utente può crearne), quindi si va di riconoscimento sul nome, in
 * italiano e inglese. Chi non matcha nutre la Saggezza: portare a termine
 * ciò che si è deciso è saggezza comunque.
 */
export function statForCategory(categoryName: string | null | undefined): StatKey {
  const n = (categoryName ?? "").toLowerCase();
  if (/palestra|fitness|sport|allenament|workout|gym|corsa|muscol/.test(n)) return "for";
  if (/salute|health|benessere|corpo|dieta|nutri/.test(n)) return "cos";
  if (/stud|learn|lettura|libri|book|creativ|scrittura|lingua|corso|hobby/.test(n)) return "int";
  if (/finanz|finance|soldi|risparmi|money|invest/.test(n)) return "oro";
  return "sag";
}

/** Le sfide giornaliere nutrono la stat del gesto che premiano. */
export function statForChallengeType(type: string): StatKey {
  switch (type) {
    case "log_gym": return "for";
    case "complete_meals":
    case "log_weight": return "cos";
    case "log_expense":
    case "check_shopping": return "oro";
    default: return "sag";
  }
}

/**
 * Conversione XP → punti stat nei punti in cui un'azione dà entrambi:
 * metà, arrotondata per eccesso, mai zero. Un solo posto per la regola.
 */
export function statPointsFromXp(xp: number): number {
  return Math.max(1, Math.ceil((Number(xp) || 0) / 2));
}

// ── Punteggio 8 → 20 ────────────────────────────────────────────────────

export const BASE_SCORE = 8;
export const MAX_SCORE = 20;

/** Costo del gradino: passare da 8+k a 9+k costa 10·(k+1) punti. */
function stepCost(k: number): number {
  return 10 * (k + 1);
}

export type ScoreInfo = {
  score: number;
  /** Punti spesi per arrivare al punteggio attuale. */
  spent: number;
  /** Punti accumulati verso il gradino successivo (0 se al cap). */
  towardNext: number;
  /** Costo del gradino successivo, null al cap. */
  nextCost: number | null;
};

/**
 * Da punti accumulati a punteggio di scheda. La crescita rallenta salendo:
 * 8 → 9 costa 10 punti, 19 → 20 ne costa 120; arrivare al cap è una
 * carriera (780 punti), non una settimana buona.
 */
export function scoreFromPoints(totalPoints: number): ScoreInfo {
  let remaining = Math.max(0, Math.floor(Number(totalPoints) || 0));
  let score = BASE_SCORE;
  let spent = 0;

  for (let k = 0; score < MAX_SCORE; k++) {
    const cost = stepCost(k);
    if (remaining < cost) {
      return { score, spent, towardNext: remaining, nextCost: cost };
    }
    remaining -= cost;
    spent += cost;
    score += 1;
  }

  return { score: MAX_SCORE, spent, towardNext: 0, nextCost: null };
}

// ── La classe emergente ─────────────────────────────────────────────────

/** Sotto questa soglia di punti totali si è ancora nessuno. */
export const CLASS_UNLOCK_TOTAL = 50;

/** Quando la seconda stat regge il passo della prima, la classe è ibrida. */
export const HYBRID_RATIO = 0.8;

export type HeroClassInfo = {
  name: string;
  icon: string;
  /** Le stat che la definiscono, in ordine di peso. */
  stats: StatKey[];
  /** Frase mostrata sotto il nome: cosa manca o cosa ti definisce. */
  flavor: string;
};

const BASE_CLASS: Record<StatKey, { name: string; icon: string }> = {
  for: { name: "Guerriero", icon: "⚔️" },
  cos: { name: "Barbaro",   icon: "🪓" },
  int: { name: "Mago",      icon: "🔮" },
  sag: { name: "Monaco",    icon: "🧘" },
  oro: { name: "Mercante",  icon: "⚖️" },
};

/** Coppie appaiate → classe ibrida. Chiave: le due stat in ordine alfabetico. */
const HYBRID_CLASS: Record<string, { name: string; icon: string }> = {
  "for|sag": { name: "Paladino", icon: "⚜️" },
  "cos|for": { name: "Campione", icon: "🏆" },
  "int|oro": { name: "Artefice", icon: "⚙️" },
  "int|sag": { name: "Druido",   icon: "🌿" },
};

function hybridFor(a: StatKey, b: StatKey) {
  return HYBRID_CLASS[[a, b].sort().join("|")];
}

/**
 * La classe è la fotografia del profilo: dominante secca → classe pura,
 * due stat appaiate (la seconda ad almeno l'80% della prima) → ibrida se
 * la coppia ne ha una. L'ordine di STATS fa da spareggio, così il
 * risultato è deterministico anche a punti pari.
 */
export function computeHeroClass(totals: StatTotals): HeroClassInfo {
  const grandTotal = STATS.reduce((a, s) => a + (totals[s.key] || 0), 0);

  if (grandTotal < CLASS_UNLOCK_TOTAL) {
    return {
      name: "Avventuriero senza nome",
      icon: "🎒",
      stats: [],
      flavor: `Ancora ${CLASS_UNLOCK_TOTAL - grandTotal} ${CLASS_UNLOCK_TOTAL - grandTotal === 1 ? "punto" : "punti"} e il tuo cammino avrà un nome.`,
    };
  }

  const ranked = [...STATS]
    .map((s) => ({ key: s.key, total: totals[s.key] || 0 }))
    .sort((a, b) => b.total - a.total);

  const [first, second] = ranked;

  if (second.total > 0 && second.total >= first.total * HYBRID_RATIO) {
    const hybrid = hybridFor(first.key, second.key);
    if (hybrid) {
      return {
        name: hybrid.name,
        icon: hybrid.icon,
        stats: [first.key, second.key],
        flavor: `${STAT_BY_KEY.get(first.key)!.label} e ${STAT_BY_KEY.get(second.key)!.label} corrono appaiate.`,
      };
    }
  }

  const base = BASE_CLASS[first.key];
  const def = STAT_BY_KEY.get(first.key)!;

  // Un'ibrida a portata di mano si annuncia: è il gancio per variare.
  const nearHybrid = ranked
    .slice(1)
    .find(
      (r) =>
        r.total > 0 &&
        r.total >= first.total * 0.6 &&
        r.total < first.total * HYBRID_RATIO &&
        hybridFor(first.key, r.key)
    );

  return {
    name: base.name,
    icon: base.icon,
    stats: [first.key],
    flavor: nearHybrid
      ? `A un passo da: ${hybridFor(first.key, nearHybrid.key)!.name}.`
      : `La tua ${def.label} guida il cammino.`,
  };
}
