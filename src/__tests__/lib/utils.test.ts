import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calculateStreak,
  getProgressColor,
  getPriorityColor,
  getPriorityLabel,
  formatDate,
} from "@/lib/utils";

describe("calculateStreak", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

  it("returns 0 for empty array", () => {
    expect(calculateStreak([])).toBe(0);
  });

  it("returns 0 for all null dates", () => {
    expect(calculateStreak([null, null])).toBe(0);
  });

  it("returns 1 when only today has a completion", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00Z"));
    expect(calculateStreak([new Date("2026-06-03")])).toBe(1);
  });

  it("returns 1 when only yesterday has a completion (today is empty)", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00Z"));
    expect(calculateStreak([new Date("2026-06-02")])).toBe(1);
  });

  it("returns 0 when last completion was 2+ days ago", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00Z"));
    expect(calculateStreak([new Date("2026-06-01")])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00Z"));
    expect(calculateStreak([
      new Date("2026-06-01"),
      new Date("2026-06-02"),
      new Date("2026-06-03"),
    ])).toBe(3);
  });

  it("stops counting at a gap", () => {
    vi.setSystemTime(new Date("2026-06-05T10:00:00Z"));
    expect(calculateStreak([
      new Date("2026-06-01"),
      new Date("2026-06-02"),
      new Date("2026-06-04"),
      new Date("2026-06-05"),
    ])).toBe(2);
  });

  it("deduplicates multiple completions on the same day", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00Z"));
    expect(calculateStreak([
      new Date("2026-06-03T08:00:00Z"),
      new Date("2026-06-03T14:00:00Z"),
    ])).toBe(1);
  });

  it("ignores null values mixed with valid dates", () => {
    vi.setSystemTime(new Date("2026-06-03T10:00:00Z"));
    expect(calculateStreak([null, new Date("2026-06-02"), null, new Date("2026-06-03")])).toBe(2);
  });
});

describe("getProgressColor", () => {
  it("returns red for 0%", () => expect(getProgressColor(0)).toBe("bg-red-400"));
  it("returns red for 29%", () => expect(getProgressColor(29)).toBe("bg-red-400"));
  it("returns yellow at 30%", () => expect(getProgressColor(30)).toBe("bg-yellow-500"));
  it("returns yellow at 59%", () => expect(getProgressColor(59)).toBe("bg-yellow-500"));
  it("returns blue at 60%", () => expect(getProgressColor(60)).toBe("bg-blue-500"));
  it("returns blue at 99%", () => expect(getProgressColor(99)).toBe("bg-blue-500"));
  it("returns green at 100%", () => expect(getProgressColor(100)).toBe("bg-green-500"));
});

describe("getPriorityColor", () => {
  it("high → red", () => expect(getPriorityColor("high")).toBe("text-red-500 bg-red-50"));
  it("medium → yellow", () => expect(getPriorityColor("medium")).toBe("text-yellow-600 bg-yellow-50"));
  it("low → green", () => expect(getPriorityColor("low")).toBe("text-green-600 bg-green-50"));
  it("unknown → gray", () => expect(getPriorityColor("unknown")).toBe("text-gray-500 bg-gray-50"));
});

describe("getPriorityLabel", () => {
  it("high → 'Alta'", () => expect(getPriorityLabel("high")).toBe("Alta"));
  it("medium → 'Media'", () => expect(getPriorityLabel("medium")).toBe("Media"));
  it("low → 'Bassa'", () => expect(getPriorityLabel("low")).toBe("Bassa"));
  it("unknown → echoes the input", () => expect(getPriorityLabel("critical")).toBe("critical"));
});

describe("formatDate", () => {
  it("formats a Date object in D Mon YYYY style", () => {
    const result = formatDate(new Date("2026-06-03T00:00:00Z"));
    expect(result).toMatch(/\d+ \w{3} \d{4}/);
  });

  it("accepts a string date", () => {
    const result = formatDate("2026-01-15");
    expect(result).toMatch(/15/);
  });
});
