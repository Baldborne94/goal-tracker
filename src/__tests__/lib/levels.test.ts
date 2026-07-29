import { describe, it, expect } from "vitest";
import { LEVEL_THRESHOLDS, getLevel, getLevelProgress, getTiers } from "@/lib/levels";

// Una sola scala per tutti: la classe non si sceglie più, e i livelli
// tornano a misurare soltanto quanta strada è stata fatta.

describe("la scala dei livelli", () => {
  it("ha otto gradini, numerati da 1", () => {
    const tiers = getTiers();
    expect(tiers).toHaveLength(8);
    expect(tiers.map((t) => t.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("ogni gradino ha etichetta, icona e confini", () => {
    for (const tier of getTiers()) {
      expect(tier.label).toBeTruthy();
      expect(tier.icon).toBeTruthy();
      expect(typeof tier.min).toBe("number");
      expect(typeof tier.max).toBe("number");
    }
  });

  it("i confini sono contigui: nessun XP resta senza livello", () => {
    const tiers = getTiers();
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].min).toBe(tiers[i - 1].max + 1);
    }
    expect(tiers[0].min).toBe(0);
    expect(tiers[tiers.length - 1].max).toBe(Infinity);
  });

  it("nessun nome allude a una classe: quelle si guadagnano", () => {
    const classNames = [
      "guerriero", "barbaro", "mago", "monaco", "mercante",
      "paladino", "campione", "artefice", "druido",
    ];
    const labels = getTiers().map((t) => t.label.toLowerCase());
    for (const name of classNames) expect(labels).not.toContain(name);
  });
});

describe("getLevel", () => {
  it("parte dal primo gradino", () => {
    expect(getLevel(0).level).toBe(1);
  });

  it("sale esattamente sulla soglia, non prima", () => {
    expect(getLevel(199).level).toBe(1);
    expect(getLevel(200).level).toBe(2);
    expect(getLevel(599).level).toBe(2);
    expect(getLevel(600).level).toBe(3);
  });

  it("oltre l'ultima soglia resta all'ultimo gradino", () => {
    expect(getLevel(20000).level).toBe(8);
    expect(getLevel(999999).level).toBe(8);
  });

  it("XP negativi o assurdi valgono zero, non un errore", () => {
    expect(getLevel(-100).level).toBe(1);
    expect(getLevel(NaN).level).toBe(1);
  });
});

describe("getLevelProgress", () => {
  it("a inizio gradino la barra è a zero", () => {
    const p = getLevelProgress(200);
    expect(p.current.level).toBe(2);
    expect(p.progress).toBe(0);
    expect(p.next?.level).toBe(3);
  });

  it("a metà strada è a metà", () => {
    // gradino 2: da 200 a 600, quindi 400 è il punto di mezzo
    expect(getLevelProgress(400).progress).toBe(50);
  });

  it("dice quanti XP mancano al gradino dopo", () => {
    expect(getLevelProgress(500).xpNeeded).toBe(100);
  });

  it("all'ultimo gradino non c'è un dopo", () => {
    const p = getLevelProgress(50000);
    expect(p.next).toBeNull();
    expect(p.progress).toBe(100);
    expect(p.xpNeeded).toBe(0);
  });
});

describe("LEVEL_THRESHOLDS", () => {
  it("è la stessa scala restituita da getTiers", () => {
    expect(LEVEL_THRESHOLDS).toEqual(getTiers());
  });
});
