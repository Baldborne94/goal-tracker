import { describe, it, expect } from "vitest";
import { calculateStreak, dayKey, dayRange, serverDayKey } from "@/lib/utils";

// Il bug che questi test proteggono: il server gira in UTC, l'utente vive in
// Italia. Fra mezzanotte e le due (ora legale, +02:00) la data UTC è ancora
// quella di ieri, e ogni "oggi" dell'app finiva sul giorno sbagliato.

const ROME = "Europe/Rome";

describe("dayKey", () => {
  it("l'una di notte italiana appartiene al giorno nuovo, non a ieri", () => {
    const instant = new Date("2026-07-30T00:30:00+02:00");
    // Quello che faceva prima il codice:
    expect(instant.toISOString().slice(0, 10)).toBe("2026-07-29");
    // Quello che fa adesso:
    expect(dayKey(instant, ROME)).toBe("2026-07-30");
  });

  it("regge il confine anche in ora solare (+01:00)", () => {
    expect(dayKey(new Date("2026-01-15T00:30:00+01:00"), ROME)).toBe("2026-01-15");
    expect(dayKey(new Date("2026-01-14T23:30:00+01:00"), ROME)).toBe("2026-01-14");
  });

  it("le 23:30 restano nel giorno che finisce", () => {
    expect(dayKey(new Date("2026-07-30T23:30:00+02:00"), ROME)).toBe("2026-07-30");
  });

  it("senza fuso esplicito usa quello del runtime", () => {
    const d = new Date(2026, 6, 30, 12, 0, 0);
    expect(dayKey(d)).toBe("2026-07-30");
  });

  it("non esplode su una data non valida", () => {
    expect(dayKey(new Date("spazzatura"))).toBe("");
  });
});

describe("serverDayKey", () => {
  it("usa il fuso dell'app, non quello del server", () => {
    expect(serverDayKey(new Date("2026-07-30T00:30:00+02:00"))).toBe("2026-07-30");
  });
});

describe("dayRange", () => {
  it("il giorno comincia a mezzanotte italiana, non a mezzanotte UTC", () => {
    const { start, end } = dayRange(new Date("2026-07-30T12:00:00+02:00"), ROME);
    // Mezzanotte a Roma d'estate = 22:00 UTC del giorno prima.
    expect(start.toISOString()).toBe("2026-07-29T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-30T22:00:00.000Z");
  });

  it("segue l'ora solare quando cambia", () => {
    const { start } = dayRange(new Date("2026-01-15T12:00:00+01:00"), ROME);
    expect(start.toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });

  it("un istante notturno cade dentro il proprio giorno", () => {
    const nightOwl = new Date("2026-07-30T00:30:00+02:00");
    const { start, end } = dayRange(nightOwl, ROME);
    expect(nightOwl >= start && nightOwl < end).toBe(true);
  });
});

describe("calculateStreak", () => {
  const at = (iso: string) => new Date(iso);

  it("conta i giorni consecutivi fino a oggi", () => {
    const days = [0, 1, 2].map((i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(12, 0, 0, 0);
      return d;
    });
    // Mezzogiorno cade nello stesso giorno in ogni fuso plausibile.
    expect(calculateStreak(days, ROME)).toBe(3);
  });

  it("non spezza la serie per un'attività notturna", () => {
    // Milestone completata all'una di notte del 30: prima finiva sul 29 e
    // lasciava un buco nella serie.
    const dates = [at("2026-07-28T12:00:00+02:00"), at("2026-07-29T12:00:00+02:00"), at("2026-07-30T00:30:00+02:00")];
    const keys = dates.map((d) => dayKey(d, ROME));
    expect(new Set(keys).size).toBe(3);
  });

  it("una lista vuota vale zero", () => {
    expect(calculateStreak([])).toBe(0);
    expect(calculateStreak([null])).toBe(0);
  });
});
