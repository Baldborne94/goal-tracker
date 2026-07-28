// Salute — metriche indossabili lette da Health Connect.
//
// Catena dei dati: Galaxy Fit3 → Samsung Health → Health Connect → app Android
// (Capacitor) → questa API → Supabase.
//
// Il registro qui sotto è l'unico punto in cui si dichiara una metrica: DB,
// API e UI leggono tutti da qui, quindi aggiungerne una nuova non richiede
// migration (la tabella HealthMetric è generica).

/** Modalità di riduzione dei campioni di una giornata a un singolo numero. */
export type Aggregation = "sum" | "avg" | "max" | "last";

export type MetricDef = {
  /** Chiave persistita in HealthMetric.metricType. Coincide con il dataType del plugin. */
  key: string;
  label: string;
  icon: string;
  /** Unità in cui il valore viene salvato (non necessariamente quella mostrata). */
  unit: string;
  aggregation: Aggregation;
  /** Priorità di sincronizzazione, dalla tabella delle specifiche. */
  priority: "alta" | "media" | "bassa";
  /** Quanti giorni indietro leggere al primo sync. */
  historyDays: number;
  /**
   * Metriche che Samsung Health spesso NON scrive verso Health Connect.
   * Vanno gestite come "dato assente", non come errore.
   */
  unreliable?: boolean;
  note?: string;
};

export const METRICS: MetricDef[] = [
  { key: "steps",                label: "Passi",              icon: "👟", unit: "count",       aggregation: "sum",  priority: "alta",  historyDays: 30 },
  { key: "calories",             label: "Calorie attive",     icon: "🔥", unit: "kilocalorie", aggregation: "sum",  priority: "alta",  historyDays: 30 },
  { key: "totalCalories",        label: "Calorie totali",     icon: "⚡", unit: "kilocalorie", aggregation: "sum",  priority: "alta",  historyDays: 30 },
  { key: "sleep",                label: "Sonno",              icon: "😴", unit: "minute",      aggregation: "sum",  priority: "alta",  historyDays: 30 },
  { key: "heartRate",            label: "Battito cardiaco",   icon: "❤️", unit: "bpm",         aggregation: "avg",  priority: "alta",  historyDays: 7 },
  {
    key: "restingHeartRate", label: "Battito a riposo", icon: "💤", unit: "bpm", aggregation: "avg", priority: "media", historyDays: 30,
    unreliable: true,
    note: "Samsung Health spesso non scrive questo dato su Health Connect.",
  },
  { key: "distance",             label: "Distanza",           icon: "📍", unit: "meter",       aggregation: "sum",  priority: "media", historyDays: 30 },
  { key: "oxygenSaturation",     label: "Ossigenazione",      icon: "🫁", unit: "percent",     aggregation: "avg",  priority: "media", historyDays: 30 },
  { key: "workouts",             label: "Allenamenti",        icon: "🏃", unit: "minute",      aggregation: "sum",  priority: "media", historyDays: 30 },
  {
    key: "heartRateVariability", label: "HRV", icon: "📈", unit: "millisecond", aggregation: "avg", priority: "media", historyDays: 30,
    unreliable: true,
    note: "Samsung Health spesso non scrive questo dato su Health Connect.",
  },
  { key: "flightsClimbed",       label: "Piani saliti",       icon: "🪜", unit: "count",       aggregation: "sum",  priority: "bassa", historyDays: 30 },
  { key: "weight",               label: "Peso",               icon: "⚖️", unit: "kilogram",    aggregation: "last", priority: "bassa", historyDays: 90 },
  { key: "bodyFat",              label: "Massa grassa",       icon: "🧬", unit: "percent",     aggregation: "last", priority: "bassa", historyDays: 90 },
];

export const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

export function getMetric(key: string): MetricDef | undefined {
  return METRIC_BY_KEY.get(key);
}

export function isKnownMetric(key: string): boolean {
  return METRIC_BY_KEY.has(key);
}

/**
 * Lo stress NON è ottenibile: Health Connect non ha un tipo di record per lo
 * stress, è una metrica proprietaria Samsung. Se serve, va inserito a mano.
 */
export const UNAVAILABLE_METRICS = [
  { label: "Stress", reason: "Health Connect non espone un tipo di record per lo stress: è una metrica proprietaria Samsung. Va inserita manualmente." },
];

// ── Campioni grezzi dal plugin ──────────────────────────────────────────

export type SleepStage = {
  startDate: string;
  endDate: string;
  stage: string; // inBed | asleep | awake | rem | deep | light
  durationMinutes: number;
};

/** Sottoinsieme di HealthSample di @capgo/capacitor-health che ci serve. */
export type RawSample = {
  dataType: string;
  value: number;
  unit?: string;
  startDate: string;
  endDate?: string;
  sourceName?: string;
  platformId?: string;
  sleepState?: string;
  stages?: SleepStage[];
  workoutType?: string;
  totalEnergyBurned?: number;
  totalDistance?: number;
};

export type HealthMetricInput = {
  metricType: string;
  value: number;
  unit: string;
  recordedAt: string;
  date: string;
  sourceName?: string;
  dedupKey: string;
  metadata?: Record<string, unknown>;
};

/** "YYYY-MM-DD" nel fuso orario locale del dispositivo (non UTC). */
export function localDateKey(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Chiave di deduplica. Rileggere lo stesso giorno non deve creare righe
 * doppie: quando Health Connect espone l'id del record lo usiamo così com'è,
 * altrimenti ricadiamo su (tipo, inizio, fine, sorgente). In entrambi i casi
 * la chiave NON contiene il valore, così un campione corretto a posteriori
 * aggiorna la riga esistente invece di affiancarne una nuova.
 */
export function buildDedupKey(sample: RawSample): string {
  if (sample.platformId) return `${sample.dataType}:${sample.platformId}`;
  const end = sample.endDate ?? sample.startDate;
  return `${sample.dataType}:${sample.startDate}:${end}:${sample.sourceName ?? "unknown"}`;
}

/** Totali per fase di sonno, in minuti. */
export function sleepStageTotals(stages: SleepStage[] | undefined): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const s of stages ?? []) {
    if (!s?.stage) continue;
    totals[s.stage] = (totals[s.stage] ?? 0) + (Number(s.durationMinutes) || 0);
  }
  return totals;
}

/**
 * Normalizza i campioni del plugin in righe HealthMetric.
 * Scarta i campioni di tipo sconosciuto e quelli con valori non numerici
 * invece di far fallire l'intero sync.
 */
export function normalizeSamples(samples: RawSample[]): HealthMetricInput[] {
  const out: HealthMetricInput[] = [];

  for (const s of samples ?? []) {
    const def = METRIC_BY_KEY.get(s?.dataType);
    if (!def) continue;

    const value = Number(s.value);
    if (!Number.isFinite(value)) continue;

    const date = localDateKey(s.startDate);
    if (!date) continue;

    const metadata: Record<string, unknown> = {};
    if (s.dataType === "sleep") {
      const stages = s.stages ?? [];
      if (stages.length > 0) {
        metadata.stages = stages;
        metadata.byStage = sleepStageTotals(stages);
      }
      if (s.sleepState) metadata.sleepState = s.sleepState;
    }
    if (s.dataType === "workouts") {
      if (s.workoutType) metadata.workoutType = s.workoutType;
      if (Number.isFinite(Number(s.totalEnergyBurned))) metadata.calories = Number(s.totalEnergyBurned);
      if (Number.isFinite(Number(s.totalDistance))) metadata.distance = Number(s.totalDistance);
    }
    if (s.endDate) metadata.endDate = s.endDate;

    out.push({
      metricType: def.key,
      value,
      unit: s.unit || def.unit,
      recordedAt: s.startDate,
      date,
      sourceName: s.sourceName,
      dedupKey: buildDedupKey(s),
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  return out;
}

/** Rimuove i doppioni interni a un batch, tenendo l'ultimo campione per chiave. */
export function dedupeBatch(inputs: HealthMetricInput[]): HealthMetricInput[] {
  const byKey = new Map<string, HealthMetricInput>();
  for (const input of inputs) byKey.set(input.dedupKey, input);
  return [...byKey.values()];
}

// ── Aggregazione ────────────────────────────────────────────────────────

export type StoredMetric = {
  metricType: string;
  value: number;
  date: string;
  recordedAt: string | Date;
  metadata?: unknown;
};

function reduce(values: number[], mode: Aggregation): number {
  if (values.length === 0) return 0;
  switch (mode) {
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
    case "max": return Math.max(...values);
    case "last": return values[values.length - 1];
  }
}

/**
 * Riduce i campioni a un valore per giorno, secondo l'aggregazione della
 * metrica. I campioni vanno passati ordinati per recordedAt crescente perché
 * "last" abbia senso.
 */
export function aggregateDaily(metrics: StoredMetric[], metricType: string): Map<string, number> {
  const def = METRIC_BY_KEY.get(metricType);
  const mode: Aggregation = def?.aggregation ?? "sum";

  const byDate = new Map<string, number[]>();
  for (const m of metrics) {
    if (m.metricType !== metricType) continue;
    const list = byDate.get(m.date) ?? [];
    list.push(Number(m.value) || 0);
    byDate.set(m.date, list);
  }

  const out = new Map<string, number>();
  for (const [date, values] of byDate) out.set(date, reduce(values, mode));
  return out;
}

/** Serie continua di `days` giorni fino a `endDate` inclusa, con 0 sui buchi. */
export function dailySeries(
  metrics: StoredMetric[],
  metricType: string,
  days: number,
  endDate: Date = new Date()
): { date: string; value: number; hasData: boolean }[] {
  const daily = aggregateDaily(metrics, metricType);
  const series: { date: string; value: number; hasData: boolean }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const value = daily.get(key);
    series.push({ date: key, value: value ?? 0, hasData: value !== undefined });
  }

  return series;
}

// ── Formattazione (it-IT) ───────────────────────────────────────────────

export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Valore già aggregato → stringa leggibile, unità inclusa. */
export function formatMetricValue(metricType: string, value: number): string {
  const n = Number(value) || 0;
  switch (metricType) {
    case "sleep":
    case "workouts":
      return formatDuration(n);
    case "distance":
      return n >= 1000
        ? `${(n / 1000).toLocaleString("it-IT", { maximumFractionDigits: 2 })} km`
        : `${Math.round(n)} m`;
    case "steps":
    case "flightsClimbed":
      return Math.round(n).toLocaleString("it-IT");
    case "calories":
    case "totalCalories":
      return `${Math.round(n).toLocaleString("it-IT")} kcal`;
    case "heartRate":
    case "restingHeartRate":
      return `${Math.round(n)} bpm`;
    case "oxygenSaturation":
    case "bodyFat":
      return `${n.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
    case "heartRateVariability":
      return `${Math.round(n)} ms`;
    case "weight":
      return `${n.toLocaleString("it-IT", { maximumFractionDigits: 1 })} kg`;
    default:
      return n.toLocaleString("it-IT", { maximumFractionDigits: 2 });
  }
}

export const SLEEP_STAGE_LABELS: Record<string, string> = {
  deep: "Profondo",
  light: "Leggero",
  rem: "REM",
  awake: "Sveglio",
  asleep: "Dormito",
  inBed: "A letto",
};

export const SLEEP_STAGE_COLORS: Record<string, string> = {
  deep: "#6366f1",
  light: "#38bdf8",
  rem: "#a855f7",
  awake: "#f97316",
  asleep: "#22c55e",
  inBed: "#64748b",
};
