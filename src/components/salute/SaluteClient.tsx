"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  METRICS,
  UNAVAILABLE_METRICS,
  SLEEP_STAGE_COLORS,
  SLEEP_STAGE_LABELS,
  aggregateDaily,
  dailySeries,
  formatDuration,
  formatMetricValue,
  getMetric,
  localDateKey,
  normalizeSamples,
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

function MetricBarChart({ metricType, metrics, days }: { metricType: string; metrics: ApiMetric[]; days: number }) {
  const series = dailySeries(metrics, metricType, days);
  const max = Math.max(...series.map((p) => p.value), 1);
  const today = localDateKey(new Date());
  const accent = "var(--theme-accent)";

  return (
    <div className="flex items-end gap-1 h-28">
      {series.map((p) => {
        const isToday = p.date === today;
        return (
          <div key={p.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${(p.value / max) * 100}%`,
                minHeight: 2,
                background: p.hasData ? accent : "rgba(120,120,140,0.25)",
                opacity: isToday ? 1 : 0.65,
              }}
              title={`${p.date}: ${p.hasData ? formatMetricValue(metricType, p.value) : "nessun dato"}`}
            />
            {days <= 7 && (
              <p className="text-[9px] truncate" style={{ color: isToday ? "var(--theme-accent)" : "var(--theme-text-muted)" }}>
                {new Date(p.date + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short" }).slice(0, 3)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SleepStages({ metrics }: { metrics: ApiMetric[] }) {
  const today = localDateKey(new Date());
  const totals: Record<string, number> = {};

  for (const m of metrics) {
    if (m.metricType !== "sleep" || m.date !== today) continue;
    const byStage = (m.metadata as { byStage?: Record<string, number> } | null)?.byStage;
    for (const [stage, mins] of Object.entries(byStage ?? {})) {
      totals[stage] = (totals[stage] ?? 0) + (Number(mins) || 0);
    }
  }

  const entries = Object.entries(totals).filter(([, v]) => v > 0);
  if (entries.length === 0) return null;
  const sum = entries.reduce((a, [, v]) => a + v, 0);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold" style={{ color: "var(--theme-text-muted)" }}>Fasi di stanotte</p>
      <div className="flex h-3 rounded-full overflow-hidden">
        {entries.map(([stage, mins]) => (
          <div key={stage} style={{ width: `${(mins / sum) * 100}%`, background: SLEEP_STAGE_COLORS[stage] ?? "#64748b" }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {entries.map(([stage, mins]) => (
          <span key={stage} className="text-[11px] flex items-center gap-1" style={{ color: "var(--theme-text-muted)" }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: SLEEP_STAGE_COLORS[stage] ?? "#64748b" }} />
            {SLEEP_STAGE_LABELS[stage] ?? stage} {formatDuration(mins)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SaluteClient() {
  const [metrics, setMetrics] = useState<ApiMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [selected, setSelected] = useState("steps");
  const [days, setDays] = useState(7);
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/health?days=30");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics ?? []);
        setLastSync(data.lastSync ?? null);
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

  const today = localDateKey(new Date());
  const todayValue = (key: string): number | null => {
    const value = aggregateDaily(metrics, key).get(today);
    return value === undefined ? null : value;
  };

  const selectedDef = getMetric(selected);

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-amber-400">❤️ Salute</h1>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
            Dati del Galaxy Fit3 via Health Connect
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="px-3 py-2 rounded-xl text-sm font-semibold active:scale-95 transition-transform disabled:opacity-50"
          style={{ background: "var(--theme-accent)", color: "#0b0b13" }}
        >
          {syncing ? "Sincronizzo…" : "↻ Aggiorna"}
        </button>
      </div>

      {lastSync && (
        <p className="text-[11px]" style={{ color: "var(--theme-text-muted)" }}>
          Ultimo aggiornamento: {new Date(lastSync).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

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
          {outcome.failed.length > 0 && (
            <p style={{ color: "var(--theme-text-muted)" }}>
              Dato assente per: {outcome.failed.map((f) => getMetric(f.metric)?.label ?? f.metric).join(", ")}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>Caricamento…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {METRICS.map((m) => {
              const value = todayValue(m.key);
              const active = selected === m.key;
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
                  <p className="text-xs flex items-center gap-1" style={{ color: "var(--theme-text-muted)" }}>
                    <span>{m.icon}</span> {m.label}
                  </p>
                  <p className="text-lg font-bold mt-1" style={{ color: value === null ? "var(--theme-text-muted)" : "var(--theme-text)" }}>
                    {value === null ? "—" : formatMetricValue(m.key, value)}
                  </p>
                  {value === null && m.unreliable && (
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--theme-text-muted)" }}>
                      spesso non condiviso
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border rounded-2xl p-4 space-y-3" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <div className="flex items-center justify-between">
              <p className="font-semibold" style={{ color: "var(--theme-text)" }}>
                {selectedDef?.icon} {selectedDef?.label}
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

            <MetricBarChart metricType={selected} metrics={metrics} days={days} />

            {selectedDef?.note && (
              <p className="text-[11px]" style={{ color: "var(--theme-text-muted)" }}>⚠️ {selectedDef.note}</p>
            )}

            {selected === "sleep" && <SleepStages metrics={metrics} />}
          </div>

          <div
            className="rounded-2xl border px-4 py-3 text-[11px] leading-relaxed space-y-1"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
          >
            {UNAVAILABLE_METRICS.map((u) => (
              <p key={u.label}>ℹ️ <span className="font-semibold">{u.label}</span>: {u.reason}</p>
            ))}
            <p>
              Vuoi che una missione si spunti da sola? Impostale una metrica e una soglia in{" "}
              <Link href="/goals" className="underline" style={{ color: "var(--theme-accent)" }}>Missioni</Link>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
