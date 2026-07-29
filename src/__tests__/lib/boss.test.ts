import { describe, it, expect } from "vitest";
import {
  BOSSES,
  bossForWeek,
  buildProgress,
  formatBossValue,
  weekKey,
  type BossMetric,
} from "@/lib/boss";

describe("weekKey — calendario ISO", () => {
  it("riconosce la settimana giusta", () => {
    expect(weekKey(new Date("2026-07-29T12:00:00Z"))).toBe("2026-W31");
    expect(weekKey(new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01");
  });

  it("a cavallo d'anno la settimana appartiene all'anno del suo giovedì", () => {
    // 31 dicembre 2024 è un martedì: la sua settimana è già del 2025.
    expect(weekKey(new Date("2024-12-31T12:00:00Z"))).toBe("2025-W01");
  });

  it("tutti i giorni della stessa settimana danno la stessa chiave", () => {
    const keys = ["27", "28", "29", "30", "31"].map((d) =>
      weekKey(new Date(`2026-07-${d}T12:00:00Z`))
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("lunedì apre una settimana nuova", () => {
    expect(weekKey(new Date("2026-07-26T12:00:00Z"))).not.toBe(weekKey(new Date("2026-07-27T12:00:00Z")));
  });
});

describe("bossForWeek", () => {
  it("è lo stesso per tutta la settimana", () => {
    const a = bossForWeek(new Date("2026-07-27T08:00:00Z"));
    const b = bossForWeek(new Date("2026-08-02T23:00:00Z"));
    expect(a.id).toBe(b.id);
  });

  it("cambia da una settimana all'altra", () => {
    const a = bossForWeek(new Date("2026-07-29T12:00:00Z"));
    const b = bossForWeek(new Date("2026-08-05T12:00:00Z"));
    expect(a.id).not.toBe(b.id);
  });

  it("nel giro di quattro settimane li incontri tutti", () => {
    const ids = [0, 1, 2, 3].map((w) =>
      bossForWeek(new Date(2026, 6, 29 + w * 7, 12)).id
    );
    expect(new Set(ids).size).toBe(BOSSES.length);
  });
});

describe("il bestiario", () => {
  it("ogni boss chiede tre cose e paga in XP e statistiche", () => {
    for (const boss of BOSSES) {
      expect(boss.conditions).toHaveLength(3);
      expect(boss.xp).toBeGreaterThan(0);
      expect(boss.stats.length).toBeGreaterThan(0);
      // Tre condizioni uguali non sarebbero tre condizioni.
      expect(new Set(boss.conditions.map((c) => c.metric)).size).toBe(3);
    }
  });

  it("nessun id ripetuto: l'id è ciò che impedisce di riscuotere due volte", () => {
    expect(new Set(BOSSES.map((b) => b.id)).size).toBe(BOSSES.length);
  });
});

describe("buildProgress", () => {
  const boss = BOSSES[0]; // Il Sedentario: gym 3, steps 50000, habitDays 5
  const values = (v: Partial<Record<BossMetric, number>>) => v;

  it("a mani vuote sei a zero e il boss è in piedi", () => {
    const p = buildProgress(boss, "2026-W31", values({}), false);
    expect(p.percent).toBe(0);
    expect(p.defeated).toBe(false);
  });

  it("la barra è la media dei tre progressi, non il totale", () => {
    // gym 3/3 (100%), steps 25000/50000 (50%), habit 0/5 (0%) → 50%
    const p = buildProgress(boss, "2026-W31", values({ gym: 3, steps: 25000, habitDays: 0 }), false);
    expect(p.percent).toBe(50);
  });

  it("superare una soglia non fa sforare la barra oltre il 100%", () => {
    const p = buildProgress(boss, "2026-W31", values({ gym: 30, steps: 500000, habitDays: 50 }), false);
    expect(p.percent).toBe(100);
    expect(p.defeated).toBe(true);
  });

  it("il boss cade solo con tutte e tre le condizioni", () => {
    const quasi = buildProgress(boss, "2026-W31", values({ gym: 3, steps: 50000, habitDays: 4 }), false);
    expect(quasi.defeated).toBe(false);

    const fatta = buildProgress(boss, "2026-W31", values({ gym: 3, steps: 50000, habitDays: 5 }), false);
    expect(fatta.defeated).toBe(true);
  });

  it("valori assurdi non rompono il conteggio", () => {
    const p = buildProgress(boss, "2026-W31", values({ gym: -5, steps: NaN }), false);
    expect(p.percent).toBe(0);
    expect(p.conditions.every((c) => c.current >= 0)).toBe(true);
  });

  it("porta con sé se la vittoria è già stata riscossa", () => {
    const p = buildProgress(boss, "2026-W31", values({ gym: 3, steps: 50000, habitDays: 5 }), true);
    expect(p).toMatchObject({ defeated: true, claimed: true });
  });
});

describe("formatBossValue", () => {
  it("i passi si leggono col separatore, il resto no", () => {
    expect(formatBossValue("steps", 50000)).toBe("50.000");
    expect(formatBossValue("gym", 3)).toBe("3");
  });
});
