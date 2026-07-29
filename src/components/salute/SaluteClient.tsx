"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  METRICS,
  SLEEP_STAGE_COLORS,
  SLEEP_STAGE_LABELS,
  aggregateDaily,
  computeDelta,
  dailySeries,
  formatDuration,
  formatMetricValue,
  formatRelativeTime,
  getMetric,
  hasData,
  localDateKey,
  normalizeSamples,
  sleepStageSeries,
  type MetricDelta,
  type StoredMetric,
} from "@/lib/health";
import {
  checkAvailability,
  openHealthConnectSettings,
  readAllMetrics,
  requestPermissions,
  type HealthAvailability,
} from "@/lib/capacitor-health";

type ApiMetric = StoredMetric & {
  id: string;
  unit: string;
  sourceName: string | null;
  metadata: unknown;
};

/** Soglia di una missione collegata a una metrica: diventa la barra obiettivo. */
type ApiGoal = { metric: string; target: number; title: string };

type SyncOutcome = {
  saved: number;
  autoCheckIns: { goalTitle: string; xp: number; date: string }[];
  denied: string[];
  empty: string[];
  failed: { metric: string; error: string }[];
};

const RANGES = [
  { days: 7, label: "7 giorni" },
  { days: 30, label: "30 giorni" },
];

// Ogni quanto rileggere Health Connect mentre la schermata è aperta. Più
// stretto sarebbe inutile: Health Connect si popola quando decide la sorgente
// (Samsung Health o Health Sync), non a nostra richiesta.
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

const weekday = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short" }).slice(0, 3);

const shortDate = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });

// ── Pezzi del grafico ───────────────────────────────────────────────────

/** Variazione rispetto a ieri (o alla media): dà una direzione al numero. */
function Delta({ delta, metricType, compact }: { delta: MetricDelta | null; metricType: string; compact?: boolean }) {
  if (!delta) return null;

  const def = getMetric(metricType);
  const arrow = delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "→";

  // Il verde/rosso è ammesso solo dove "di più" è davvero meglio; altrove la
  // variazione resta in inchiostro neutro, con la freccia a dire il verso.
  const good = delta.direction === "up" ? def?.moreIsBetter : !def?.moreIsBetter;
  const color =
    delta.direction === "flat" || def?.moreIsBetter === undefined
      ? "var(--theme-text-muted)"
      : good
        ? "#4ade80"
        : "#fca5a5";

  const magnitude =
    delta.direction === "flat"
      ? "in linea"
      : `${arrow} ${Math.abs(Math.round(delta.pct))}%`;

  const basis = delta.basis === "yesterday" ? "rispetto a ieri" : "sulla media";

  return (
    <span className="text-[11px] font-semibold" style={{ color }}>
      {magnitude}
      {!compact && delta.direction !== "flat" && (
        <span className="font-normal" style={{ color: "var(--theme-text-muted)" }}> {basis}</span>
      )}
    </span>
  );
}

/** Micro-linea a 7 giorni con l'ultimo punto in evidenza. */
function Sparkline({ metricType, metrics }: { metricType: string; metrics: ApiMetric[] }) {
  const series = dailySeries(metrics, metricType, 7);
  const values = series.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const span = max - min || 1;

  const points = values.map((v, i) => {
    const x = 2 + (i * 48) / (values.length - 1);
    // Serie piatta: la linea sta a metà altezza, non schiacciata sul fondo.
    const y = max === min ? 8 : 14 - ((v - min) / span) * 12;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const [lastX, lastY] = points[points.length - 1].split(",");

  return (
    <svg width="52" height="16" viewBox="0 0 52 16" aria-hidden="true" className="flex-none">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--theme-text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <circle cx={lastX} cy={lastY} r="2.6" fill="var(--theme-accent)" />
    </svg>
  );
}

/** Barre giornaliere: oggi in evidenza, i giorni senza dati in grigio. */
function MetricBarChart({
  metricType,
  metrics,
  days,
  height = "h-28",
}: {
  metricType: string;
  metrics: ApiMetric[];
  days: number;
  height?: string;
}) {
  const series = dailySeries(metrics, metricType, days);
  const max = Math.max(...series.map((p) => p.value), 1);
  const today = localDateKey(new Date());

  return (
    // Le colonne devono essere alte quanto il grafico: senza `h-full` le
    // percentuali delle barre non hanno un contenitore su cui calcolarsi.
    <div className={`flex gap-1 ${height}`}>
      {series.map((p) => {
        const isToday = p.date === today;
        return (
          <div key={p.date} className="flex-1 min-w-0 h-full flex flex-col items-center gap-1">
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${(p.value / max) * 100}%`,
                  minHeight: 2,
                  background: p.hasData ? "var(--theme-accent)" : "rgba(120,120,140,0.25)",
                  opacity: isToday || !p.hasData ? 1 : 0.55,
                }}
                title={`${shortDate(p.date)}: ${p.hasData ? formatMetricValue(metricType, p.value) : "nessun dato"}`}
              />
            </div>
            {days <= 7 && (
              <p
                className="text-[9px] truncate"
                style={{ color: isToday ? "var(--theme-accent)" : "var(--theme-text-muted)" }}
              >
                {weekday(p.date)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Barra delle fasi di una singola notte, con i minuti per fase. */
function SleepStageBar({ stages }: { stages: { stage: string; minutes: number }[] }) {
  if (stages.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-[2px] h-3">
        {stages.map((s, i) => (
          <div
            key={s.stage}
            className={i === 0 ? "rounded-l-full" : i === stages.length - 1 ? "rounded-r-full" : ""}
            style={{ flexGrow: s.minutes, background: SLEEP_STAGE_COLORS[s.stage] ?? "#64748b" }}
            title={`${SLEEP_STAGE_LABELS[s.stage] ?? s.stage}: ${formatDuration(s.minutes)}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {stages.map((s) => (
          <span key={s.stage} className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--theme-text-muted)" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: SLEEP_STAGE_COLORS[s.stage] ?? "#64748b" }} />
            {SLEEP_STAGE_LABELS[s.stage] ?? s.stage} {formatDuration(s.minutes)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Andamento del sonno: una colonna per notte, divisa nelle sue fasi, con la
 * media del periodo come riferimento. Le notti che la sorgente non ha
 * classificato restano una barra piena — il totale c'è comunque.
 */
function SleepTrend({ metrics, days }: { metrics: ApiMetric[]; days: number }) {
  const series = sleepStageSeries(metrics, days);
  const withData = series.filter((d) => d.total > 0);
  const max = Math.max(...series.map((d) => d.total), 1);
  const average = withData.length > 0 ? withData.reduce((a, d) => a + d.total, 0) / withData.length : 0;
  const today = localDateKey(new Date());

  const legend = [...new Set(series.flatMap((d) => d.stages.map((s) => s.stage)))];

  if (withData.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: "var(--theme-text-muted)" }}>
        Nessuna notte registrata negli ultimi {days} giorni.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative h-32">
        {average > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed pointer-events-none"
            style={{ bottom: `${(average / max) * 100}%`, borderColor: "var(--theme-text-muted)", opacity: 0.45 }}
          >
            <span
              className="absolute right-0 -top-4 text-[9px] px-1 rounded"
              style={{ color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}
            >
              media {formatDuration(average)}
            </span>
          </div>
        )}

        <div className="flex items-end gap-1 h-full">
          {series.map((d) => {
            const isToday = d.date === today;
            const detail =
              d.total === 0
                ? "nessun dato"
                : [
                    formatDuration(d.total),
                    ...d.stages.map((s) => `${SLEEP_STAGE_LABELS[s.stage] ?? s.stage} ${formatDuration(s.minutes)}`),
                  ].join(" · ");

            return (
              <div key={d.date} className="flex-1 min-w-0 h-full flex flex-col justify-end">
                <div
                  className="w-full flex flex-col-reverse gap-[2px] rounded-t-sm overflow-hidden"
                  style={{
                    height: `${(d.total / max) * 100}%`,
                    minHeight: d.total > 0 ? 3 : 2,
                    background: d.total > 0 ? undefined : "rgba(120,120,140,0.25)",
                    opacity: isToday || d.total === 0 ? 1 : 0.8,
                  }}
                  title={`${shortDate(d.date)}: ${detail}`}
                >
                  {d.stages.length > 0
                    ? d.stages.map((s) => (
                        <div
                          key={s.stage}
                          style={{ flexGrow: s.minutes, background: SLEEP_STAGE_COLORS[s.stage] ?? "#64748b" }}
                        />
                      ))
                    : d.total > 0 && <div className="flex-1" style={{ background: SLEEP_STAGE_COLORS.asleep }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {days <= 7 && (
        <div className="flex gap-1">
          {series.map((d) => (
            <p
              key={d.date}
              className="flex-1 text-center text-[9px] truncate"
              style={{ color: d.date === today ? "var(--theme-accent)" : "var(--theme-text-muted)" }}
            >
              {weekday(d.date)}
            </p>
          ))}
        </div>
      )}

      {legend.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          {legend.map((stage) => (
            <span key={stage} className="text-[10px] flex items-center gap-1.5" style={{ color: "var(--theme-text-muted)" }}>
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: SLEEP_STAGE_COLORS[stage] ?? "#64748b" }} />
              {SLEEP_STAGE_LABELS[stage] ?? stage}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Barra di avanzamento verso la soglia di una missione. */
function GoalBar({ metricType, value, goal }: { metricType: string; value: number; goal: ApiGoal }) {
  const pct = Math.min(100, (value / goal.target) * 100);
  const missing = Math.max(0, goal.target - value);

  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px]" style={{ color: "var(--theme-text-muted)" }}>
        <span className="truncate">Obiettivo {formatMetricValue(metricType, goal.target)}</span>
        <span className="flex-none">
          {missing > 0 ? `mancano ${formatMetricValue(metricType, missing)}` : "raggiunto 🎉"}
        </span>
      </div>
      <div className="h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(120,120,140,0.25)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--theme-bar)" }} />
      </div>
    </div>
  );
}

// ── Schermata ───────────────────────────────────────────────────────────

export default function SaluteClient() {
  const [metrics, setMetrics] = useState<ApiMetric[]>([]);
  const [goals, setGoals] = useState<ApiGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/health?days=30");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics ?? []);
        setGoals(data.goals ?? []);
      }
    } catch {
      // la schermata resta consultabile con i dati già in pagina
    } finally {
      setLoading(false);
    }
  }, []);

  const syncingRef = useRef(false);
  const lastSyncAt = useRef(0);

  /**
   * Legge Health Connect e manda al server quello che trova.
   *
   * `interactive` distingue il tocco su Aggiorna da un giro automatico. Solo
   * il primo può aprire il foglio dei permessi — richiederli a ogni apertura
   * della schermata sarebbe invadente — e solo il primo riporta errori ed
   * esito: un sync automatico che fallisce non deve interrompere la lettura
   * dei dati già in pagina.
   */
  const runSync = useCallback(
    async (interactive: boolean) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (interactive) {
        setSyncing(true);
        setError(null);
        setOutcome(null);
      }

      try {
        const avail = await checkAvailability();
        setAvailability(avail);
        if (!avail.available) {
          if (interactive) setError(avail.message);
          return;
        }

        if (interactive) await requestPermissions();

        const { samples, denied, empty, failed } = await readAllMetrics(30);
        const normalized = normalizeSamples(samples);

        const res = await fetch("/api/health/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metrics: normalized }),
        });
        if (!res.ok) {
          if (interactive) setError((await res.json().catch(() => ({}))).error ?? "Sincronizzazione fallita");
          return;
        }

        const data = await res.json();
        lastSyncAt.current = Date.now();
        // Quando abbiamo parlato con Health Connect, non quando è arrivato
        // l'ultimo dato nuovo: è la domanda a cui l'utente vuole risposta.
        setSyncedAt(new Date());
        const result: SyncOutcome = {
          saved: data.saved ?? 0,
          autoCheckIns: data.autoCheckIns ?? [],
          denied,
          empty,
          failed,
        };
        // In automatico si resta in silenzio, tranne quando c'è qualcosa da
        // festeggiare: una missione che si è spuntata da sola va detta.
        if (interactive || result.autoCheckIns.length > 0) setOutcome(result);
        await load();
      } catch (e) {
        if (interactive) setError((e as Error).message);
      } finally {
        syncingRef.current = false;
        if (interactive) setSyncing(false);
      }
    },
    [load]
  );

  const sync = useCallback(() => runSync(true), [runSync]);

  // All'apertura: prima i dati già salvati (immediati), poi un giro silenzioso
  // per prendere quello che nel frattempo è arrivato in Health Connect.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (!cancelled) await runSync(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load, runSync]);

  // Mentre la schermata resta aperta, e ogni volta che l'app torna in primo
  // piano. È il massimo avvicinamento al tempo reale ottenibile: il ritardo
  // residuo è quello con cui la sorgente riempie Health Connect.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSyncAt.current < AUTO_SYNC_INTERVAL_MS) return;
      void runSync(false);
    };
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [runSync]);

  // "Sincronizzato 2 minuti fa" deve invecchiare da solo, anche se nessun
  // altro stato cambia.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const today = localDateKey(new Date());
  const todayValue = useCallback(
    (key: string): number | null => {
      const value = aggregateDaily(metrics, key).get(today);
      return value === undefined ? null : value;
    },
    [metrics, today]
  );

  const goalFor = (key: string) => goals.find((g) => g.metric === key);

  /**
   * Cosa merita un riquadro: le metriche che il braccialetto misura di sicuro
   * (anche vuote — lì il trattino significa "non ha sincronizzato") e tutte
   * quelle che hanno dati veri. Le altre semplicemente non esistono in questa
   * schermata: HRV e battito a riposo Samsung non li condivide, il Fit3 non ha
   * l'altimetro, la massa grassa vuole una bilancia smart. Compariranno da sole
   * il giorno in cui un dato arriverà.
   */
  const secondary = useMemo(
    () =>
      METRICS.filter(
        (m) => m.key !== "steps" && m.key !== "sleep" && (m.core || hasData(metrics, m.key))
      ),
    [metrics]
  );

  // La lista segue l'ordine fisso del registro e la prima voce è sempre una
  // metrica `core` (le calorie attive), quindi il riquadro predefinito non si
  // sposta quando un sync ne fa comparire di nuove.
  const detail = selected && secondary.some((m) => m.key === selected) ? selected : secondary[0]?.key;
  const detailDef = detail ? getMetric(detail) : undefined;

  const stepsToday = todayValue("steps");
  const stepsGoal = goalFor("steps");
  const sleepNights = sleepStageSeries(metrics, 1);
  const sleepToday = todayValue("sleep");

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-400">❤️ Salute</h1>
          <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--theme-text-muted)" }}>
            {syncedAt ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full inline-block flex-none" style={{ background: "#22c55e" }} />
                Sincronizzato {formatRelativeTime(syncedAt)}
              </>
            ) : (
              "Dati del Galaxy Fit3 via Health Connect"
            )}
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="px-3 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50 flex-none"
          style={{ background: "var(--theme-accent)", color: "#0b0b13" }}
        >
          {syncing ? "Sincronizzo…" : "↻ Aggiorna"}
        </button>
      </div>

      {availability && !availability.available && (
        <div
          className="rounded-2xl border px-4 py-3 text-xs leading-relaxed space-y-2"
          style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
        >
          <p>📱 {availability.message}</p>
          {availability.reason === "unavailable" && (
            <button onClick={openHealthConnectSettings} className="underline" style={{ color: "var(--theme-accent)" }}>
              Apri le impostazioni di Health Connect
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border px-4 py-3 text-xs" style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {outcome && (
        // Zero misurazioni non è un successo: quasi sempre significa permessi
        // non concessi, e presentarlo con la spunta verde nasconde il problema.
        <div
          className="rounded-2xl border px-4 py-3 text-xs space-y-2"
          style={
            outcome.saved > 0
              ? { background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.4)", color: "#86efac" }
              : { background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.4)", color: "#fcd34d" }
          }
        >
          <p>
            {outcome.saved > 0
              ? `✅ ${outcome.saved} misurazioni sincronizzate.`
              : "⚠️ Nessuna misurazione letta."}
          </p>

          {outcome.denied.length > 0 && (
            <div className="space-y-1">
              <p>
                Permesso di lettura non concesso per{" "}
                {outcome.denied.length === METRICS.length
                  ? "nessuna metrica"
                  : outcome.denied.map((k) => getMetric(k)?.label ?? k).join(", ")}
                {outcome.denied.length === METRICS.length ? "" : "."}
              </p>
              <button onClick={openHealthConnectSettings} className="underline font-semibold">
                Apri i permessi di Health Connect
              </button>
            </div>
          )}

          {outcome.denied.length === 0 && outcome.saved === 0 && outcome.empty.length > 0 && (
            <p style={{ color: "var(--theme-text-muted)" }}>
              Permessi concessi, ma Health Connect non ha dati per il periodo. Controlla che Samsung
              Health stia condividendo i dati e che il braccialetto abbia sincronizzato di recente.
            </p>
          )}
          {outcome.autoCheckIns.map((c) => (
            <p key={`${c.goalTitle}-${c.date}`}>🎉 «{c.goalTitle}» completata dai dati del braccialetto · +{c.xp} XP</p>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>Caricamento…</p>
      ) : (
        <>
          {/* I passi guidano: sono il dato che c'è tutti i giorni. */}
          <div
            className="border rounded-2xl p-4"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--theme-text-muted)" }}>
              👟 Passi oggi
            </p>
            <div className="flex items-baseline gap-2 mt-1">
              <p
                className="text-3xl font-extrabold tabular-nums"
                style={{ color: stepsToday === null ? "var(--theme-text-muted)" : "var(--theme-text)" }}
              >
                {stepsToday === null ? "—" : formatMetricValue("steps", stepsToday)}
              </p>
              <Delta delta={computeDelta(metrics, "steps")} metricType="steps" />
            </div>

            {stepsGoal && stepsToday !== null && (
              <GoalBar metricType="steps" value={stepsToday} goal={stepsGoal} />
            )}

            <div className="mt-3">
              <MetricBarChart metricType="steps" metrics={metrics} days={7} height="h-20" />
            </div>
          </div>

          {/* Riposo */}
          <p className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: "var(--theme-text-muted)" }}>
            Riposo
          </p>
          <div
            className="border rounded-2xl p-4 space-y-3"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            <div>
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--theme-text-muted)" }}>
                😴 Sonno di stanotte
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <p
                  className="text-3xl font-extrabold tabular-nums"
                  style={{ color: sleepToday === null ? "var(--theme-text-muted)" : "var(--theme-text)" }}
                >
                  {sleepToday === null ? "—" : formatDuration(sleepToday)}
                </p>
                <Delta delta={computeDelta(metrics, "sleep")} metricType="sleep" />
              </div>
            </div>

            <SleepStageBar stages={sleepNights[0]?.stages ?? []} />

            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "var(--theme-text-muted)" }}>
                  Andamento
                </p>
                <div className="flex gap-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.days}
                      onClick={() => setDays(r.days)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium"
                      style={{
                        background: days === r.days ? "var(--theme-accent)" : "transparent",
                        color: days === r.days ? "#0b0b13" : "var(--theme-text-muted)",
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <SleepTrend metrics={metrics} days={days} />
            </div>
          </div>

          {/* Attività e cuore */}
          {secondary.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: "var(--theme-text-muted)" }}>
                Attività e cuore
              </p>
              <div className="grid grid-cols-2 gap-2">
                {secondary.map((m) => {
                  const value = todayValue(m.key);
                  const active = detail === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setSelected(m.key)}
                      className="border rounded-2xl p-3 text-left active:scale-95 transition-transform"
                      style={{
                        background: "var(--theme-surface)",
                        borderColor: active ? "var(--theme-accent)" : "var(--theme-surface-border)",
                      }}
                    >
                      <p className="text-xs flex items-center gap-1 truncate" style={{ color: "var(--theme-text-muted)" }}>
                        <span>{m.icon}</span> {m.label}
                      </p>
                      <p
                        className="text-lg font-bold mt-1 tabular-nums"
                        style={{ color: value === null ? "var(--theme-text-muted)" : "var(--theme-text)" }}
                      >
                        {value === null ? "—" : formatMetricValue(m.key, value)}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-2 min-h-[16px]">
                        <Delta delta={computeDelta(metrics, m.key)} metricType={m.key} compact />
                        {hasData(metrics, m.key) && <Sparkline metricType={m.key} metrics={metrics} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {detail && detailDef && (
            <div
              className="border rounded-2xl p-4 space-y-3"
              style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold" style={{ color: "var(--theme-text)" }}>
                  {detailDef.icon} {detailDef.label}
                </p>
                <div className="flex gap-1">
                  {RANGES.map((r) => (
                    <button
                      key={r.days}
                      onClick={() => setDays(r.days)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium"
                      style={{
                        background: days === r.days ? "var(--theme-accent)" : "transparent",
                        color: days === r.days ? "#0b0b13" : "var(--theme-text-muted)",
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <MetricBarChart metricType={detail} metrics={metrics} days={days} />

              {goalFor(detail) && todayValue(detail) !== null && (
                <GoalBar metricType={detail} value={todayValue(detail)!} goal={goalFor(detail)!} />
              )}

              {detailDef.note && (
                <p className="text-[11px]" style={{ color: "var(--theme-text-muted)" }}>⚠️ {detailDef.note}</p>
              )}
            </div>
          )}

          <p className="text-[11px] leading-relaxed px-1" style={{ color: "var(--theme-text-muted)" }}>
            Vuoi che una missione si spunti da sola? Impostale una metrica e una soglia in{" "}
            <Link href="/goals" className="underline" style={{ color: "var(--theme-accent)" }}>Missioni</Link>.
          </p>
        </>
      )}
    </div>
  );
}
