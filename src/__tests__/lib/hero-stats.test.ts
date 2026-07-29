import { describe, it, expect } from "vitest";
import {
  BASE_SCORE,
  CLASS_UNLOCK_TOTAL,
  EMPTY_TOTALS,
  MAX_SCORE,
  computeHeroClass,
  scoreFromPoints,
  statForCategory,
  statForChallengeType,
  statPointsFromXp,
  type StatTotals,
} from "@/lib/hero-stats";

const totals = (over: Partial<StatTotals>): StatTotals => ({ ...EMPTY_TOTALS, ...over });

describe("scoreFromPoints — la curva 8 → 20", () => {
  it("parte da 8, come il popolano", () => {
    expect(scoreFromPoints(0)).toMatchObject({ score: BASE_SCORE, towardNext: 0, nextCost: 10 });
  });

  it("il primo gradino costa 10, il secondo 20", () => {
    expect(scoreFromPoints(9).score).toBe(8);
    expect(scoreFromPoints(10).score).toBe(9);
    expect(scoreFromPoints(29).score).toBe(9);
    expect(scoreFromPoints(30).score).toBe(10);
  });

  it("tiene il conto verso il gradino successivo", () => {
    const info = scoreFromPoints(17);
    expect(info).toMatchObject({ score: 9, towardNext: 7, nextCost: 20 });
  });

  it("arrivare a 20 è una carriera: 780 punti, e lì si ferma", () => {
    expect(scoreFromPoints(779).score).toBe(19);
    expect(scoreFromPoints(780)).toMatchObject({ score: MAX_SCORE, towardNext: 0, nextCost: null });
    expect(scoreFromPoints(99999).score).toBe(MAX_SCORE);
  });

  it("non si fa ingannare da input sporchi", () => {
    expect(scoreFromPoints(-5).score).toBe(BASE_SCORE);
    expect(scoreFromPoints(NaN).score).toBe(BASE_SCORE);
  });
});

describe("statForCategory", () => {
  it("riconosce le categorie in italiano e inglese", () => {
    expect(statForCategory("Palestra")).toBe("for");
    expect(statForCategory("Health")).toBe("cos");
    expect(statForCategory("Learning")).toBe("int");
    expect(statForCategory("Lettura")).toBe("int");
    expect(statForCategory("Finance")).toBe("oro");
  });

  it("chi non matcha nutre la Saggezza", () => {
    expect(statForCategory("Personal")).toBe("sag");
    expect(statForCategory(null)).toBe("sag");
    expect(statForCategory(undefined)).toBe("sag");
  });
});

describe("statForChallengeType", () => {
  it("la sfida nutre la stat del gesto che premia", () => {
    expect(statForChallengeType("log_gym")).toBe("for");
    expect(statForChallengeType("complete_meals")).toBe("cos");
    expect(statForChallengeType("log_weight")).toBe("cos");
    expect(statForChallengeType("log_expense")).toBe("oro");
    expect(statForChallengeType("check_shopping")).toBe("oro");
    expect(statForChallengeType("complete_milestone")).toBe("sag");
  });
});

describe("statPointsFromXp", () => {
  it("metà XP, per eccesso, mai zero", () => {
    expect(statPointsFromXp(10)).toBe(5);
    expect(statPointsFromXp(25)).toBe(13);
    expect(statPointsFromXp(1)).toBe(1);
    expect(statPointsFromXp(0)).toBe(1);
  });
});

describe("computeHeroClass", () => {
  it("sotto la soglia si è ancora nessuno", () => {
    const c = computeHeroClass(totals({ for: CLASS_UNLOCK_TOTAL - 1 }));
    expect(c.name).toBe("Avventuriero senza nome");
    expect(c.flavor).toContain("1 punto e");
  });

  it("la dominante secca battezza la classe pura", () => {
    expect(computeHeroClass(totals({ for: 100, sag: 20 })).name).toBe("Guerriero");
    expect(computeHeroClass(totals({ int: 100 })).name).toBe("Mago");
    expect(computeHeroClass(totals({ oro: 100 })).name).toBe("Mercante");
  });

  it("due stat appaiate danno l'ibrida, se la coppia ne ha una", () => {
    expect(computeHeroClass(totals({ for: 100, sag: 85 })).name).toBe("Paladino");
    expect(computeHeroClass(totals({ int: 100, oro: 80 })).name).toBe("Artefice");
    expect(computeHeroClass(totals({ for: 100, cos: 90 })).name).toBe("Campione");
    expect(computeHeroClass(totals({ int: 100, sag: 95 })).name).toBe("Druido");
  });

  it("una coppia senza ibrida ricade sulla dominante", () => {
    // for+oro non ha una classe ibrida definita
    expect(computeHeroClass(totals({ for: 100, oro: 90 })).name).toBe("Guerriero");
  });

  it("annuncia l'ibrida a portata di mano", () => {
    const c = computeHeroClass(totals({ for: 100, sag: 70 }));
    expect(c.name).toBe("Guerriero");
    expect(c.flavor).toContain("Paladino");
  });

  it("a punti pari lo spareggio è deterministico (ordine di STATS)", () => {
    const a = computeHeroClass(totals({ for: 60, int: 60 }));
    const b = computeHeroClass(totals({ int: 60, for: 60 }));
    expect(a.name).toBe(b.name);
  });
});
