import { CLASSES, getClassDef } from "@/lib/classes";
import type { HeroClass } from "@/lib/classes";

export interface LevelEntry {
  level: number;
  label: string;
  icon: string;
  min: number;
  max: number;
}

export function getTiers(heroClass?: HeroClass | string | null): LevelEntry[] {
  const cls = getClassDef(heroClass);
  return cls.tiers.map((t, i) => ({ level: i + 1, ...t }));
}

export function getLevel(points: number, heroClass?: HeroClass | string | null): LevelEntry {
  const tiers = getTiers(heroClass);
  return tiers.find((t) => points >= t.min && points <= t.max) ?? tiers[0];
}

export function getLevelProgress(
  points: number,
  heroClass?: HeroClass | string | null
): {
  current: LevelEntry;
  next: LevelEntry | null;
  progress: number;
  xpNeeded: number;
} {
  const tiers = getTiers(heroClass);
  const current = getLevel(points, heroClass);
  const currentIdx = tiers.findIndex((t) => t.level === current.level);
  const next = currentIdx + 1 < tiers.length ? tiers[currentIdx + 1] : null;

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

// Backward-compat alias (Fighter tiers)
export const LEVEL_THRESHOLDS = getTiers("fighter");
