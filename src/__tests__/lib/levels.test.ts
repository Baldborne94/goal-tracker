import { describe, it, expect } from "vitest";
import { getLevel, getLevelProgress, getTiers } from "@/lib/levels";

describe("getTiers", () => {
  it("returns 8 tiers for fighter (default)", () => {
    expect(getTiers("fighter")).toHaveLength(8);
  });

  it("returns 8 tiers for every hero class", () => {
    const classes = ["fighter","paladin","barbarian","ranger","druid","rogue","wizard","sorcerer","necromancer","cleric","bard","monk"];
    for (const cls of classes) {
      expect(getTiers(cls), `${cls} should have 8 tiers`).toHaveLength(8);
    }
  });

  it("falls back to fighter for unknown class", () => {
    const unknown = getTiers("dragon");
    const fighter = getTiers("fighter");
    expect(unknown[0].label).toBe(fighter[0].label);
  });

  it("each tier has level, label, icon, min, max", () => {
    const tiers = getTiers("fighter");
    for (const tier of tiers) {
      expect(tier).toHaveProperty("level");
      expect(tier).toHaveProperty("label");
      expect(tier).toHaveProperty("icon");
      expect(tier).toHaveProperty("min");
      expect(tier).toHaveProperty("max");
    }
  });
});

describe("getLevel", () => {
  it("returns tier 1 at 0 XP", () => {
    expect(getLevel(0, "fighter").level).toBe(1);
  });

  it("returns tier 1 at 199 XP (just below threshold)", () => {
    expect(getLevel(199, "fighter").level).toBe(1);
  });

  it("returns tier 2 at exactly 200 XP", () => {
    expect(getLevel(200, "fighter").level).toBe(2);
  });

  it("returns tier 3 at 600 XP", () => {
    expect(getLevel(600, "fighter").level).toBe(3);
  });

  it("returns tier 4 at 1500 XP", () => {
    expect(getLevel(1500, "fighter").level).toBe(4);
  });

  it("returns tier 8 (max) at 20000+ XP", () => {
    expect(getLevel(20000, "fighter").level).toBe(8);
    expect(getLevel(99999, "fighter").level).toBe(8);
  });

  it("uses class-specific tier labels", () => {
    const fighter = getLevel(0, "fighter");
    const necromancer = getLevel(0, "necromancer");
    expect(fighter.label).not.toBe(necromancer.label);
    expect(necromancer.label).toBe("Raccoglitore di Ossa");
  });

  it("falls back to fighter tier when class is null", () => {
    expect(getLevel(0, null).label).toBe(getLevel(0, "fighter").label);
  });
});

describe("getLevelProgress", () => {
  it("returns progress 0 at the start of tier 1 (0 XP)", () => {
    const { progress, current } = getLevelProgress(0, "fighter");
    expect(current.level).toBe(1);
    expect(progress).toBe(0);
  });

  it("returns progress 100 and xpNeeded 0 at max tier", () => {
    const { progress, xpNeeded, next } = getLevelProgress(20000, "fighter");
    expect(progress).toBe(100);
    expect(xpNeeded).toBe(0);
    expect(next).toBeNull();
  });

  it("calculates correct progress within a tier", () => {
    const { progress, xpNeeded } = getLevelProgress(100, "fighter");
    expect(progress).toBe(50);
    expect(xpNeeded).toBe(100);
  });

  it("returns next tier reference", () => {
    const { current, next } = getLevelProgress(0, "fighter");
    expect(next).not.toBeNull();
    expect(next!.level).toBe(current.level + 1);
  });

  it("progress is capped between 0 and 100", () => {
    const { progress } = getLevelProgress(200, "fighter");
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(100);
  });
});
