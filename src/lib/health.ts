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
  /**
   * Metriche che la schermata mostra anche quando sono vuote, perché il
   * braccialetto le misura di sicuro: lì il trattino è un'informazione (manca
   * la sincronizzazione). Tutte le altre compaiono solo se hanno dati, così
   * chi non ha il sensore non si ritrova mezzo schermo di caselle vuote.
   */
  core?: boolean;
  /**
   * Solo dove "di più" è davvero un miglioramento (passi, sonno, distanza) la
   * variazione può essere colorata. Su battito e ossigenazione un +8% verde
   * sarebbe un giudizio clinico che non siamo in grado di dare.
   */
  moreIsBetter?: boolean;
  note?: string;
};

export const METRICS: MetricDef[] = [
  { key: "steps",                label: "Passi",              icon: "👟", unit: "count",       aggregation: "sum",  priority: "alta",  historyDays: 30, core: true, moreIsBetter: true },
  { key: "calories",             label: "Calorie attive",     icon: "🔥", unit: "kilocalorie", aggregation: "sum",  priority: "alta",  historyDays: 30, core: true, moreIsBetter: true },
  { key: "totalCalories",        label: "Calorie totali",     icon: "⚡", unit: "kilocalorie", aggregation: "sum",  priority: "alta",  historyDays: 30, moreIsBetter: true },
  { key: "sleep",                label: "Sonno",              icon: "😴", unit: "minute",      aggregation: "sum",  priority: "alta",  historyDays: 30, core: true, moreIsBetter: true },
  { key: "heartRate",            label: "Battito cardiaco",   icon: "❤️", unit: "bpm",         aggregation: "avg",  priority: "alta",  historyDays: 7,  core: true },
  {
    key: "restingHeartRate", label: "Battito a riposo", icon: "💤", unit: "bpm", aggregation: "avg", priority: "media", historyDays: 30,
    unreliable: true,
    note: "Samsung Health spesso non scrive questo dato su Health Connect.",
  },
  { key: "distance",             label: "Distanza",           icon: "📍", unit: "meter",       aggregation: "sum",  priority: "media", historyDays: 30, core: true, moreIsBetter: true },
  { key: "oxygenSaturation",     label: "Ossigenazione",      icon: "🫁", unit: "percent",     aggregation: "avg",  priority: "media", historyDays: 30 },
  { key: "workouts",             label: "Allenamenti",        icon: "🏃", unit: "minute",      aggregation: "sum",  priority: "media", historyDays: 30, moreIsBetter: true },
  {
    key: "heartRateVariability", label: "HRV", icon: "📈", unit: "millisecond", aggregation: "avg", priority: "media", historyDays: 30,
    unreliable: true,
    note: "Samsung Health spesso non scrive questo dato su Health Connect.",
  },
  { key: "flightsClimbed",       label: "Piani saliti",       icon: "🪜", unit: "count",       aggregation: "sum",  priority: "bassa", historyDays: 30, moreIsBetter: true },
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

// Lo stress NON è ottenibile e non compare da nessuna parte nella schermata:
// Health Connect non ha un tipo di record per lo stress, è una metrica
// proprietaria Samsung. Elencare ciò che non arriverà mai è rumore, non
// informazione — se servirà, andrà inserito a mano.

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

/**
 * Palette delle fasi, verificata sul fondo scuro dell'app: la coppia
 * indaco/azzurro precedente era indistinguibile in deuteranopia e due tinte
 * uscivano dalla banda di luminosità. Ogni fase porta comunque la sua
 * etichetta con i minuti: il colore non è mai l'unico indizio.
 */
export const SLEEP_STAGE_COLORS: Record<string, string> = {
  deep: "#4f46e5",
  light: "#0d9488",
  rem: "#c026d3",
  awake: "#ea580c",
  // "asleep" è il sonno che la sorgente non ha classificato: stessa tinta del
  // leggero perché è lo stesso bucket, e l'etichetta li distingue comunque.
  asleep: "#0d9488",
  inBed: "#64748b",
};

/** Ordine di lettura delle fasi: dal sonno più profondo alla veglia. */
export const SLEEP_STAGE_ORDER = ["deep", "light", "rem", "asleep", "inBed", "awake"];

function stageRank(stage: string): number {
  const i = SLEEP_STAGE_ORDER.indexOf(stage);
  return i === -1 ? SLEEP_STAGE_ORDER.length : i;
}

// ── Derivate per la schermata ───────────────────────────────────────────

/** True se la metrica ha almeno un campione nei dati caricati. */
export function hasData(metrics: StoredMetric[], metricType: string): boolean {
  return metrics.some((m) => m.metricType === metricType);
}

export type MetricDelta = {
  /** Valore di oggi. */
  value: number;
  /** Termine di paragone. */
  reference: number;
  /** Su cosa è calcolato il confronto. */
  basis: "yesterday" | "average";
  /** Variazione percentuale rispetto al riferimento. */
  pct: number;
  direction: "up" | "down" | "flat";
};

/**
 * Confronto della giornata con il passato recente: ieri se ha dati, altrimenti
 * la media dei giorni con dati della settimana. Serve a dare una direzione al
 * numero — «54 bpm» da solo non dice com'è andata.
 *
 * Restituisce null quando manca il valore di oggi o un riferimento: un delta
 * inventato sarebbe peggio di nessun delta.
 */
export function computeDelta(
  metrics: StoredMetric[],
  metricType: string,
  endDate: Date = new Date()
): MetricDelta | null {
  const daily = aggregateDaily(metrics, metricType);
  const today = localDateKey(endDate);
  const value = daily.get(today);
  if (value === undefined) return null;

  const previous: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const v = daily.get(localDateKey(d));
    if (v !== undefined) previous.push(v);
  }
  if (previous.length === 0) return null;

  const yesterday = (() => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - 1);
    return daily.get(localDateKey(d));
  })();

  const basis: MetricDelta["basis"] = yesterday === undefined ? "average" : "yesterday";
  const reference =
    yesterday === undefined ? previous.reduce((a, b) => a + b, 0) / previous.length : yesterday;
  if (!reference) return null;

  const pct = ((value - reference) / reference) * 100;
  // Sotto il 3% la differenza è rumore di misura, non una tendenza.
  const direction: MetricDelta["direction"] = Math.abs(pct) < 3 ? "flat" : pct > 0 ? "up" : "down";

  return { value, reference, basis, pct, direction };
}

export type SleepDay = {
  date: string;
  /** Minuti totali della notte. */
  total: number;
  /** Minuti per fase, in ordine di lettura. Vuoto se la sorgente non le espone. */
  stages: { stage: string; minutes: number }[];
};

/**
 * Andamento del sonno giorno per giorno, con la scomposizione in fasi.
 *
 * Le fasi arrivano solo da readSamples() — le query aggregate di Health
 * Connect le perdono — e alcune notti ne sono prive: in quel caso `stages` è
 * vuoto e resta il solo totale, che va disegnato come barra piena.
 */
export function sleepStageSeries(
  metrics: StoredMetric[],
  days: number,
  endDate: Date = new Date()
): SleepDay[] {
  const totals = aggregateDaily(metrics, "sleep");

  const byDate = new Map<string, Record<string, number>>();
  for (const m of metrics) {
    if (m.metricType !== "sleep") continue;
    const byStage = (m.metadata as { byStage?: Record<string, number> } | null)?.byStage;
    if (!byStage) continue;
    const acc = byDate.get(m.date) ?? {};
    for (const [stage, mins] of Object.entries(byStage)) {
      acc[stage] = (acc[stage] ?? 0) + (Number(mins) || 0);
    }
    byDate.set(m.date, acc);
  }

  const out: SleepDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const date = localDateKey(d);
    const stages = Object.entries(byDate.get(date) ?? {})
      .filter(([, minutes]) => minutes > 0)
      .map(([stage, minutes]) => ({ stage, minutes }))
      .sort((a, b) => stageRank(a.stage) - stageRank(b.stage));
    out.push({ date, total: totals.get(date) ?? 0, stages });
  }
  return out;
}

/** "2 minuti fa" — quanto è vecchia l'ultima sincronizzazione. */
export function formatRelativeTime(input: string | Date, now: Date = new Date()): string {
  const then = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(then.getTime())) return "";

  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "adesso";
  if (minutes === 1) return "1 minuto fa";
  if (minutes < 60) return `${minutes} minuti fa`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 ora fa";
  if (hours < 24) return `${hours} ore fa`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "ieri" : `${days} giorni fa`;
}
