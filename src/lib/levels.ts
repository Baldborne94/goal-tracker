// I livelli: una sola scala, uguale per tutti.
//
// Prima ogni classe aveva la sua scala di titoli, e la classe si sceglieva
// al primo avvio, prima di aver fatto qualsiasi cosa. Ora l'eroe parte
// neutro e la classe la guadagna con le azioni (vedi hero-stats.ts): i
// livelli tornano a misurare una cosa sola — quanta strada hai fatto — e i
// loro nomi non alludono a un ruolo che non hai scelto. Il ruolo lo dice la
// Scheda dell'Eroe, non il livello.

export interface LevelEntry {
  level: number;
  label: string;
  icon: string;
  min: number;
  max: number;
}

const THRESHOLDS = [0, 200, 600, 1500, 3000, 6000, 10000, 20000];

// Nomi di cammino, non di mestiere: nessuno si sovrappone alle classi
// emergenti (Guerriero, Barbaro, Mago, Monaco, Mercante e le ibride).
const TIERS: { label: string; icon: string }[] = [
  { label: "Recluta",   icon: "🌱" },
  { label: "Iniziato",  icon: "🕯️" },
  { label: "Viandante", icon: "🥾" },
  { label: "Veterano",  icon: "🛡️" },
  { label: "Eroe",      icon: "⭐" },
  { label: "Prescelto", icon: "🔆" },
  { label: "Leggenda",  icon: "🏆" },
  { label: "Mito",      icon: "👑" },
];

export const LEVEL_THRESHOLDS: LevelEntry[] = TIERS.map((tier, i) => ({
  level: i + 1,
  label: tier.label,
  icon: tier.icon,
  min: THRESHOLDS[i],
  max: i + 1 < THRESHOLDS.length ? THRESHOLDS[i + 1] - 1 : Infinity,
}));

export function getTiers(): LevelEntry[] {
  return LEVEL_THRESHOLDS;
}

export function getLevel(points: number): LevelEntry {
  const p = Math.max(0, Number(points) || 0);
  return LEVEL_THRESHOLDS.find((t) => p >= t.min && p <= t.max) ?? LEVEL_THRESHOLDS[0];
}

export function getLevelProgress(points: number): {
  current: LevelEntry;
  next: LevelEntry | null;
  progress: number;
  xpNeeded: number;
} {
  const p = Math.max(0, Number(points) || 0);
  const current = getLevel(p);
  const next = LEVEL_THRESHOLDS[current.level] ?? null;

  if (!next) return { current, next: null, progress: 100, xpNeeded: 0 };

  const range = next.min - current.min;
  return {
    current,
    next,
    progress: Math.min(100, Math.round(((p - current.min) / range) * 100)),
    xpNeeded: next.min - p,
  };
}
