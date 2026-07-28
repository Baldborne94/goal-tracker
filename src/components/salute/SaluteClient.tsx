"use client";

import { useCallback, useEffect, useState } from "react";
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
  failed: { metric: string; error: string }[];
};

const RANGES = [
  { days: 7, label: "7 giorni" },
  { days: 30, label: "30 giorni" },
];

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const avail = await checkAvailability();
      if (cancelled) return;
      setAvailability(avail);
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setOutcome(null);
    try {
      const avail = await checkAvailability();
      setAvailability(avail);
      if (!avail.available) {
        setError(avail.message);
        return;
      }

      await requestPermissions();
      const { samples, failed } = await readAllMetrics(30);
      const normalized = normalizeSamples(samples);

      const res = await fetch("/api/health/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: normalized }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Sincronizzazione fallita");
        return;
      }

      const data = await res.json();
      setOutcome({ saved: data.saved ?? 0, autoCheckIns: data.autoCheckIns ?? [], failed });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [load]);

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
        <div className="rounded-2xl border px-4 py-3 text-xs space-y-2" style={{ background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.4)", color: "#86efac" }}>
          <p>✅ {outcome.saved} misurazioni sincronizzate.</p>
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
