"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type SleepLog = { id: string; date: string; hours: number; quality: number };

const QUALITY_LABELS = ["", "😫 Pessimo", "😴 Scarso", "😐 Normale", "😊 Buono", "🌟 Ottimo"];
const QUALITY_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#a855f7"];

function fmtDate(dateStr: string) {
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Stanotte";
  if (dateStr === yest) return "Ieri notte";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

function SleepBarChart({ logs }: { logs: SleepLog[] }) {
  if (logs.length === 0) return null;
  const days = 7;
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  const logMap = new Map(logs.map(l => [l.date, l]));
  const MAX_H = 12;

  return (
    <div>
      <div className="flex items-end gap-1.5 h-20">
        {dates.map(d => {
          const log = logMap.get(d);
          const pct = log ? Math.min(100, (log.hours / MAX_H) * 100) : 0;
          const isToday = d === new Date().toISOString().slice(0, 10);
          const color = log ? QUALITY_COLORS[log.quality] : "rgba(59,45,110,0.3)";
          return (
            <div key={d} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-sm transition-all" style={{ height: `${pct}%`, minHeight: 2, background: color, opacity: isToday ? 1 : 0.7 }} />
              {log && <p className="text-[9px] font-semibold" style={{ color }}>{log.hours}h</p>}
              <p className="text-[9px]" style={{ color: isToday ? "#f59e0b" : "var(--theme-text-muted)" }}>
                {new Date(d + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short" }).slice(0, 3)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SleepClient() {
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formHours, setFormHours] = useState("7.5");
  const [formQuality, setFormQuality] = useState(3);
  const [saving, setSaving] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/sleep");
      if (res.ok) setLogs(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const last7 = logs.slice(0, 7);
  const avgHours = last7.length > 0
    ? (last7.reduce((s, l) => s + l.hours, 0) / last7.length)
    : null;
  const avgQuality = last7.length > 0
    ? Math.round(last7.reduce((s, l) => s + l.quality, 0) / last7.length)
    : null;

  async function saveLog() {
    const h = parseFloat(formHours);
    if (!h || h <= 0 || h > 24) return;
    setSaving(true);
    const res = await fetch("/api/sleep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: formDate, hours: h, quality: formQuality }),
    });
    if (res.ok) {
      setShowForm(false);
      await fetchLogs();
    }
    setSaving(false);
  }

  async function deleteLog(id: string) {
    await fetch(`/api/sleep/${id}`, { method: "DELETE" });
    setLogs(prev => prev.filter(l => l.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/vita" className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold flex-shrink-0" style={{ background: "var(--theme-surface)", color: "var(--theme-text-muted)" }}>‹</Link>
        <div>
          <h1 className="text-xl font-bold text-amber-400">💤 Sonno</h1>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Monitora ore e qualità del riposo</p>
        </div>
      </div>

      {/* Stats + chart */}
      {logs.length > 0 && (
        <div className="rounded-2xl border p-4 space-y-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <div className="flex gap-4">
            <div className="flex-1 text-center">
              <p className="text-2xl font-bold text-amber-400">{avgHours?.toFixed(1)}h</p>
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Media 7 giorni</p>
            </div>
            {avgQuality !== null && (
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold" style={{ color: QUALITY_COLORS[avgQuality] }}>{QUALITY_LABELS[avgQuality]}</p>
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Qualità media</p>
              </div>
            )}
          </div>
          <SleepBarChart logs={logs} />
          <div className="flex items-center justify-end gap-3 text-[9px]" style={{ color: "var(--theme-text-muted)" }}>
            {[1,2,3,4,5].map(q => (
              <span key={q} className="flex items-center gap-0.5">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: QUALITY_COLORS[q] }} />
                {q === 1 ? "Pessimo" : q === 5 ? "Ottimo" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 && !showForm && (
        <div className="rounded-2xl border p-6 text-center space-y-2" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <p className="text-3xl">💤</p>
          <p className="text-white font-medium">Nessun dato sonno</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Inizia a registrare il tuo riposo</p>
        </div>
      )}

      {/* Log button / form */}
      {!showForm ? (
        <button
          onClick={() => { setShowForm(true); setFormDate(new Date().toISOString().slice(0, 10)); setFormHours("7.5"); setFormQuality(3); }}
          className="w-full py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform text-[#0c0a1a]"
          style={{ background: "var(--theme-accent)" }}
        >
          + Registra sonno
        </button>
      ) : (
        <div className="rounded-2xl border p-4 space-y-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <p className="text-sm font-semibold text-[#ede9ff]">Nuovo log sonno</p>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "var(--theme-text-muted)" }}>Data</label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm text-[#ede9ff] border focus:outline-none"
                style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }} />
            </div>
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: "var(--theme-text-muted)" }}>Ore dormite</label>
              <input type="number" value={formHours} onChange={e => setFormHours(e.target.value)}
                step="0.5" min="0" max="24" placeholder="7.5"
                className="w-full px-3 py-2 rounded-xl text-sm text-[#ede9ff] border focus:outline-none"
                style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }} />
            </div>
          </div>

          <div>
            <label className="text-xs mb-2 block" style={{ color: "var(--theme-text-muted)" }}>Qualità</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(q => (
                <button
                  key={q}
                  onClick={() => setFormQuality(q)}
                  className="flex-1 py-2 rounded-xl text-lg transition-all"
                  style={{
                    background: formQuality === q ? `${QUALITY_COLORS[q]}25` : "var(--theme-bg)",
                    border: `1px solid ${formQuality === q ? QUALITY_COLORS[q] : "transparent"}`,
                  }}
                >
                  {["😫","😴","😐","😊","🌟"][q-1]}
                </button>
              ))}
            </div>
            <p className="text-xs text-center mt-1" style={{ color: QUALITY_COLORS[formQuality] }}>
              {QUALITY_LABELS[formQuality]}
            </p>
          </div>

          <div className="flex gap-2">
            <button onClick={saveLog} disabled={saving || !formHours}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-[#0c0a1a] disabled:opacity-50"
              style={{ background: "var(--theme-accent)" }}>
              {saving ? "Salvando..." : "Salva"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl text-sm border"
              style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "var(--theme-text-muted)" }}>Storico</p>
          {logs.map(log => (
            <div key={log.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
              <span className="text-lg">{["😫","😴","😐","😊","🌟"][log.quality - 1]}</span>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-bold">{log.hours}h</span>
                  <span className="text-xs" style={{ color: QUALITY_COLORS[log.quality] }}>{QUALITY_LABELS[log.quality]}</span>
                </div>
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{fmtDate(log.date)}</p>
              </div>
              <button onClick={() => deleteLog(log.id)} className="text-sm leading-none hover:text-red-400 transition-colors" style={{ color: "var(--theme-surface-border)" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
