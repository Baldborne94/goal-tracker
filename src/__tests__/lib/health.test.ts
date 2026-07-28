import { describe, it, expect } from "vitest";
import {
  aggregateDaily,
  buildDedupKey,
  dailySeries,
  dedupeBatch,
  formatDuration,
  formatMetricValue,
  getMetric,
  isKnownMetric,
  localDateKey,
  normalizeSamples,
  sleepStageTotals,
  type RawSample,
  type StoredMetric,
} from "@/lib/health";

const stepSample = (over: Partial<RawSample> = {}): RawSample => ({
  dataType: "steps",
  value: 1200,
  unit: "count",
  startDate: "2026-07-20T08:00:00.000Z",
  endDate: "2026-07-20T09:00:00.000Z",
  sourceName: "Samsung Health",
  ...over,
});

describe("localDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(localDateKey(new Date(2026, 6, 5))).toBe("2026-07-05");
  });

  it("pads single-digit months and days", () => {
    expect(localDateKey(new Date(2026, 0, 9))).toBe("2026-01-09");
  });

  it("returns an empty string for an unparseable input", () => {
    expect(localDateKey("not a date")).toBe("");
  });
});

describe("buildDedupKey", () => {
  it("uses the Health Connect record id when available", () => {
    expect(buildDedupKey(stepSample({ platformId: "hc-42" }))).toBe("steps:hc-42");
  });

  it("falls back to type + interval + source when there is no record id", () => {
    expect(buildDedupKey(stepSample())).toBe(
      "steps:2026-07-20T08:00:00.000Z:2026-07-20T09:00:00.000Z:Samsung Health"
    );
  });

  it("ignores the value, so a corrected sample updates instead of duplicating", () => {
    expect(buildDedupKey(stepSample({ value: 1200 }))).toBe(buildDedupKey(stepSample({ value: 1500 })));
  });

  it("keeps distinct intervals distinct", () => {
    expect(buildDedupKey(stepSample())).not.toBe(
      buildDedupKey(stepSample({ startDate: "2026-07-20T10:00:00.000Z" }))
    );
  });
});

describe("normalizeSamples", () => {
  it("maps a known sample onto a HealthMetric row", () => {
    const [row] = normalizeSamples([stepSample({ platformId: "hc-1" })]);
    expect(row.metricType).toBe("steps");
    expect(row.value).toBe(1200);
    expect(row.unit).toBe("count");
    expect(row.dedupKey).toBe("steps:hc-1");
  });

  it("drops samples of unknown type instead of failing the whole sync", () => {
    expect(normalizeSamples([stepSample(), { ...stepSample(), dataType: "stress" }])).toHaveLength(1);
  });

  it("drops samples with a non-numeric value", () => {
    expect(normalizeSamples([stepSample({ value: NaN })])).toHaveLength(0);
  });

  it("drops samples with an unparseable date", () => {
    expect(normalizeSamples([stepSample({ startDate: "boh" })])).toHaveLength(0);
  });

  it("falls back to the registry unit when the sample has none", () => {
    const [row] = normalizeSamples([stepSample({ unit: undefined })]);
    expect(row.unit).toBe("count");
  });

  it("extracts sleep stage totals into metadata", () => {
    const [row] = normalizeSamples([
      {
        dataType: "sleep",
        value: 420,
        unit: "minute",
        startDate: "2026-07-20T23:00:00.000Z",
        platformId: "sleep-1",
        stages: [
          { startDate: "a", endDate: "b", stage: "deep", durationMinutes: 90 },
          { startDate: "b", endDate: "c", stage: "light", durationMinutes: 240 },
          { startDate: "c", endDate: "d", stage: "rem", durationMinutes: 80 },
          { startDate: "d", endDate: "e", stage: "deep", durationMinutes: 10 },
        ],
      },
    ]);
    expect(row.metadata?.byStage).toEqual({ deep: 100, light: 240, rem: 80 });
  });

  it("converts workout metadata", () => {
    const [row] = normalizeSamples([
      {
        dataType: "workouts",
        value: 45,
        unit: "minute",
        startDate: "2026-07-20T18:00:00.000Z",
        platformId: "w-1",
        workoutType: "running",
        totalEnergyBurned: 380,
        totalDistance: 6200,
      },
    ]);
    expect(row.metadata).toMatchObject({ workoutType: "running", calories: 380, distance: 6200 });
  });

  it("leaves metadata undefined when there is nothing structured to keep", () => {
    const [row] = normalizeSamples([stepSample({ endDate: undefined })]);
    expect(row.metadata).toBeUndefined();
  });
});

describe("dedupeBatch", () => {
  it("keeps one row per dedup key, the last one wins", () => {
    const batch = normalizeSamples([
      stepSample({ platformId: "hc-1", value: 100 }),
      stepSample({ platformId: "hc-1", value: 250 }),
      stepSample({ platformId: "hc-2", value: 70 }),
    ]);
    const deduped = dedupeBatch(batch);
    expect(deduped).toHaveLength(2);
    expect(deduped.find((m) => m.dedupKey === "steps:hc-1")?.value).toBe(250);
  });
});

describe("sleepStageTotals", () => {
  it("returns an empty object when there are no stages", () => {
    expect(sleepStageTotals(undefined)).toEqual({});
  });

  it("sums repeated stages", () => {
    expect(
      sleepStageTotals([
        { startDate: "a", endDate: "b", stage: "rem", durationMinutes: 20 },
        { startDate: "b", endDate: "c", stage: "rem", durationMinutes: 25 },
      ])
    ).toEqual({ rem: 45 });
  });
});

describe("aggregateDaily", () => {
  const metrics: StoredMetric[] = [
    { metricType: "steps", value: 1000, date: "2026-07-20", recordedAt: "2026-07-20T08:00:00Z" },
    { metricType: "steps", value: 2500, date: "2026-07-20", recordedAt: "2026-07-20T12:00:00Z" },
    { metricType: "steps", value: 900, date: "2026-07-21", recordedAt: "2026-07-21T09:00:00Z" },
    { metricType: "heartRate", value: 60, date: "2026-07-20", recordedAt: "2026-07-20T08:00:00Z" },
    { metricType: "heartRate", value: 80, date: "2026-07-20", recordedAt: "2026-07-20T09:00:00Z" },
    { metricType: "weight", value: 82.5, date: "2026-07-20", recordedAt: "2026-07-20T07:00:00Z" },
    { metricType: "weight", value: 82.1, date: "2026-07-20", recordedAt: "2026-07-20T20:00:00Z" },
  ];

  it("sums metrics declared as sum", () => {
    expect(aggregateDaily(metrics, "steps").get("2026-07-20")).toBe(3500);
  });

  it("averages metrics declared as avg", () => {
    expect(aggregateDaily(metrics, "heartRate").get("2026-07-20")).toBe(70);
  });

  it("takes the latest sample for metrics declared as last", () => {
    expect(aggregateDaily(metrics, "weight").get("2026-07-20")).toBe(82.1);
  });

  it("ignores other metric types", () => {
    expect(aggregateDaily(metrics, "steps").has("2026-07-22")).toBe(false);
    expect(aggregateDaily(metrics, "steps").get("2026-07-21")).toBe(900);
  });
});

describe("dailySeries", () => {
  it("fills gaps with zero and marks them as missing data", () => {
    const end = new Date(2026, 6, 22);
    const series = dailySeries(
      [{ metricType: "steps", value: 4000, date: "2026-07-22", recordedAt: "2026-07-22T08:00:00Z" }],
      "steps",
      3,
      end
    );
    expect(series.map((p) => p.date)).toEqual(["2026-07-20", "2026-07-21", "2026-07-22"]);
    expect(series.map((p) => p.hasData)).toEqual([false, false, true]);
    expect(series[0].value).toBe(0);
    expect(series[2].value).toBe(4000);
  });

  it("distinguishes a real zero from a missing day", () => {
    const end = new Date(2026, 6, 22);
    const series = dailySeries(
      [{ metricType: "steps", value: 0, date: "2026-07-22", recordedAt: "2026-07-22T08:00:00Z" }],
      "steps",
      2,
      end
    );
    expect(series[1]).toMatchObject({ value: 0, hasData: true });
    expect(series[0]).toMatchObject({ value: 0, hasData: false });
  });
});

describe("formatDuration", () => {
  it("shows minutes only under an hour", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("shows whole hours without minutes", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("shows hours and minutes", () => {
    expect(formatDuration(440)).toBe("7h 20m");
  });
});

describe("formatMetricValue", () => {
  it("renders sleep as a duration", () => {
    expect(formatMetricValue("sleep", 440)).toBe("7h 20m");
  });

  it("renders distance in km past a kilometre", () => {
    expect(formatMetricValue("distance", 6200)).toBe("6,2 km");
  });

  it("keeps short distances in metres", () => {
    expect(formatMetricValue("distance", 640)).toBe("640 m");
  });

  it("renders heart rate in bpm", () => {
    expect(formatMetricValue("heartRate", 71.4)).toBe("71 bpm");
  });

  it("renders calories with a unit", () => {
    expect(formatMetricValue("calories", 512.7)).toBe("513 kcal");
  });
});

describe("registry", () => {
  it("recognises declared metrics", () => {
    expect(isKnownMetric("steps")).toBe(true);
    expect(isKnownMetric("sleep")).toBe(true);
  });

  it("rejects stress, which Health Connect does not expose", () => {
    expect(isKnownMetric("stress")).toBe(false);
  });

  it("flags the metrics Samsung Health often fails to share", () => {
    expect(getMetric("heartRateVariability")?.unreliable).toBe(true);
    expect(getMetric("restingHeartRate")?.unreliable).toBe(true);
    expect(getMetric("steps")?.unreliable).toBeUndefined();
  });
});
