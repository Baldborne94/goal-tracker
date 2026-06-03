export const LEVEL_THRESHOLDS = [
  { level: 1, label: "Recruit",  icon: "🗡️", min: 0,     max: 199 },
  { level: 2, label: "Warrior",  icon: "⚔️", min: 200,   max: 599 },
  { level: 3, label: "Knight",   icon: "🛡️", min: 600,   max: 1499 },
  { level: 4, label: "Warlord",  icon: "🏰", min: 1500,  max: 2999 },
  { level: 5, label: "King",     icon: "👑", min: 3000,  max: 5999 },
  { level: 6, label: "Emperor",  icon: "⚜️", min: 6000,  max: 9999 },
  { level: 7, label: "Legend",   icon: "🔱", min: 10000, max: 19999 },
  { level: 8, label: "Divine",   icon: "✨", min: 20000, max: Infinity },
] as const;

export type LevelEntry = (typeof LEVEL_THRESHOLDS)[number];

export function getLevel(points: number): LevelEntry {
  return (
    LEVEL_THRESHOLDS.find((l) => points >= l.min && points <= l.max) ??
    LEVEL_THRESHOLDS[0]
  );
}

export function getLevelProgress(points: number): {
  current: LevelEntry;
  next: LevelEntry | null;
  progress: number;
  xpNeeded: number;
} {
  const current = getLevel(points);
  const nextIdx = LEVEL_THRESHOLDS.findIndex((l) => l.level === current.level) + 1;
  const next = nextIdx < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[nextIdx] : null;

  if (!next) return { current, next: null, progress: 100, xpNeeded: 0 };

  const range = next.min - current.min;
  const done = points - current.min;
  return {
    current,
    next,
    progress: Math.min(100, Math.round((done / range) * 100)),
    xpNeeded: next.min - points,
  };
}
