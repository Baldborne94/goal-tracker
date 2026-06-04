"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type BodyMeasurement = {
  id: string; date: string;
  height: number | null; waist: number | null; hips: number | null;
  chest: number | null; bicep: number | null; bodyFat: number | null;
};

type WeightEntry = {
  id: string;
  weight: number;
  note: string | null;
  date: string;
};

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtInput(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return null;

  const W = 320;
  const H = 110;
  const PAD = 18;

  const weights = entries.map((e) => e.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const toX = (i: number) =>
    PAD + (i / (entries.length - 1)) * (W - PAD * 2);
  const toY = (w: number) =>
    H - PAD - ((w - min) / range) * (H - PAD * 2);

  const pts = entries.map((e, i) => `${toX(i)},${toY(e.weight)}`).join(" ");
  const area = `${toX(0)},${H} ${pts} ${toX(entries.length - 1)},${H}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 110 }}
      aria-hidden
    >
      <defs>
        <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#wg)" />
      <polyline
        points={pts}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {entries.map((e, i) => (
        <circle
          key={e.id}
          cx={toX(i)}
          cy={toY(e.weight)}
          r={i === entries.length - 1 ? 5 : 3}
          fill={i === entries.length - 1 ? "#f59e0b" : "#7c5fcc"}
        />
      ))}
      <text
        x={toX(0)}
        y={H - 2}
        fontSize="9"
        fill="#6b5a9e"
        textAnchor="middle"
      >
        {fmt(entries[0].date)}
      </text>
      <text
        x={toX(entries.length - 1)}
        y={H - 2}
        fontSize="9"
        fill="#f59e0b"
        textAnchor="middle"
      >
        {fmt(entries[entries.length - 1].date)}
      </text>
    </svg>
  );
}

export default function PesoClient() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Body measurements
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [showMeasForm, setShowMeasForm] = useState(false);
  const [measDate, setMeasDate] = useState(new Date().toISOString().slice(0, 10));
  const [mHeight, setMHeight] = useState("");
  const [mWaist, setMWaist] = useState("");
  const [mHips, setMHips] = useState("");
  const [mChest, setMChest] = useState("");
  const [mBicep, setMBicep] = useState("");
  const [mBodyFat, setMBodyFat] = useState("");
  const [savingMeas, setSavingMeas] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [pesoRes, measRes] = await Promise.all([
        fetch("/api/peso"),
        fetch("/api/peso/measurements"),
      ]);
      if (pesoRes.ok) setEntries(await pesoRes.json());
      if (measRes.ok) setMeasurements(await measRes.json());
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function saveMeasurement() {
    setSavingMeas(true);
    const body = {
      date: measDate,
      height: mHeight ? parseFloat(mHeight) : null,
      waist: mWaist ? parseFloat(mWaist) : null,
      hips: mHips ? parseFloat(mHips) : null,
      chest: mChest ? parseFloat(mChest) : null,
      bicep: mBicep ? parseFloat(mBicep) : null,
      bodyFat: mBodyFat ? parseFloat(mBodyFat) : null,
    };
    const res = await fetch("/api/peso/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const m = await res.json() as BodyMeasurement;
      setMeasurements(prev => [m, ...prev]);
      setShowMeasForm(false);
      setMHeight(""); setMWaist(""); setMHips(""); setMChest(""); setMBicep(""); setMBodyFat("");
    }
    setSavingMeas(false);
  }

  async function deleteMeasurement(id: string) {
    await fetch(`/api/peso/measurements/${id}`, { method: "DELETE" });
    setMeasurements(prev => prev.filter(m => m.id !== id));
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  const deltaStart =
    first && latest && first.id !== latest.id
      ? latest.weight - first.weight
      : null;
  const deltaLast = prev ? latest.weight - prev.weight : null;

  async function saveEntry() {
    if (!weight || isNaN(parseFloat(weight))) return;
    setSaving(true);
    try {
      const res = await fetch("/api/peso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: parseFloat(weight),
          note: note || null,
          date,
        }),
      });
      if (res.ok) {
        setWeight("");
        setNote("");
        setDate(new Date().toISOString().slice(0, 10));
        setShowForm(false);
        await fetchData();
        setMsg("+10 XP earned!");
        setTimeout(() => setMsg(""), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/peso/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const recentDesc = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/vita" className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold flex-shrink-0" style={{ background: "var(--theme-surface)", color: "var(--theme-text-muted)" }}>‹</Link>
          <div>
            <h1 className="text-xl font-bold text-amber-400">⚖️ Weight</h1>
            <p className="text-xs text-[#6b5a9e]">Track your weight over time</p>
          </div>
        </div>
        {msg && (
          <span className="text-xs bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full font-medium">
            {msg}
          </span>
        )}
      </div>

      {/* Stats */}
      {latest && (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-bold text-white">
              {latest.weight.toFixed(1)}
            </span>
            <span className="text-lg text-[#6b5a9e] mb-1">kg</span>
            <div className="ml-auto flex flex-col items-end gap-1">
              {deltaLast !== null && (
                <span
                  className={`text-sm font-semibold ${deltaLast < 0 ? "text-green-400" : deltaLast > 0 ? "text-red-400" : "text-[#6b5a9e]"}`}
                >
                  {deltaLast > 0 ? "+" : ""}
                  {deltaLast.toFixed(1)} kg vs prev.
                </span>
              )}
              {deltaStart !== null && (
                <span
                  className={`text-xs ${deltaStart < 0 ? "text-green-500" : deltaStart > 0 ? "text-red-400" : "text-[#6b5a9e]"}`}
                >
                  {deltaStart > 0 ? "+" : ""}
                  {deltaStart.toFixed(1)} kg from start
                </span>
              )}
            </div>
          </div>

          {/* Chart */}
          <WeightChart entries={sorted.slice(-20)} />

          {sorted.length < 2 && (
            <p className="text-xs text-[#6b5a9e] text-center">
              Log at least 2 measurements to see the chart
            </p>
          )}
        </div>
      )}

      {/* CTA empty state */}
      {!latest && (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-6 text-center space-y-2">
          <p className="text-3xl">⚖️</p>
          <p className="text-white font-medium">No measurements yet</p>
          <p className="text-xs text-[#6b5a9e]">
            Start tracking your weight to earn XP and badges
          </p>
        </div>
      )}

      {/* Add button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl bg-amber-400 text-[#0c0a1a] font-bold text-sm active:scale-95 transition-transform"
        >
          + Log weight
        </button>
      ) : (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">New measurement</p>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-[#6b5a9e] mb-1 block">
                Weight (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                placeholder="e.g. 82.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#6b5a9e] mb-1 block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#6b5a9e] mb-1 block">
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. after workout"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveEntry}
              disabled={saving || !weight}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 text-[#0c0a1a] font-bold text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setWeight("");
                setNote("");
              }}
              className="px-4 py-2.5 rounded-xl border border-[#3b2d6e] text-[#6b5a9e] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recent entries */}
      {recentDesc.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#6b5a9e] uppercase tracking-wider px-1">
            History
          </p>
          {recentDesc.map((e) => (
            <div
              key={e.id}
              className="bg-[#16112e] border border-[#3b2d6e] rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <span className="text-lg">⚖️</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-bold">
                    {e.weight.toFixed(1)} kg
                  </span>
                  {e.note && (
                    <span className="text-xs text-[#6b5a9e] truncate">
                      {e.note}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#6b5a9e]">{fmt(e.date)}</p>
              </div>
              <button
                onClick={() => deleteEntry(e.id)}
                className="text-[#3b2d6e] hover:text-red-400 transition-colors text-lg leading-none"
                aria-label="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Body measurements ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#6b5a9e] uppercase tracking-wider">📏 Misurazioni corporee</p>
          <button
            onClick={() => setShowMeasForm(v => !v)}
            className="text-xs px-3 py-1 rounded-lg font-semibold"
            style={{ background: "var(--theme-surface)", color: "var(--theme-accent)" }}
          >
            {showMeasForm ? "Annulla" : "+ Aggiungi"}
          </button>
        </div>

        {/* Latest measurements snapshot */}
        {measurements.length > 0 && !showMeasForm && (() => {
          const latest = measurements[0];
          const fields: { label: string; value: number | null; unit: string }[] = [
            { label: "Altezza", value: latest.height, unit: "cm" },
            { label: "Girovita", value: latest.waist, unit: "cm" },
            { label: "Fianchi", value: latest.hips, unit: "cm" },
            { label: "Petto", value: latest.chest, unit: "cm" },
            { label: "Bicipite", value: latest.bicep, unit: "cm" },
            { label: "Grasso", value: latest.bodyFat, unit: "%" },
          ].filter(f => f.value != null);

          if (fields.length === 0) return null;
          return (
            <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 mb-2">
              <p className="text-[10px] text-[#6b5a9e] mb-2">{fmt(latest.date)}</p>
              <div className="grid grid-cols-3 gap-2">
                {fields.map(f => (
                  <div key={f.label} className="text-center px-2 py-1.5 rounded-xl" style={{ background: "var(--theme-bg)" }}>
                    <p className="text-sm font-bold text-white">{f.value}{f.unit}</p>
                    <p className="text-[9px] text-[#6b5a9e]">{f.label}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Measurement form */}
        {showMeasForm && (
          <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 space-y-3">
            <div>
              <label className="text-xs text-[#6b5a9e] mb-1 block">Data</label>
              <input type="date" value={measDate} onChange={e => setMeasDate(e.target.value)}
                className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Altezza (cm)", val: mHeight, set: setMHeight },
                { label: "Girovita (cm)", val: mWaist, set: setMWaist },
                { label: "Fianchi (cm)", val: mHips, set: setMHips },
                { label: "Petto (cm)", val: mChest, set: setMChest },
                { label: "Bicipite (cm)", val: mBicep, set: setMBicep },
                { label: "Grasso corp. (%)", val: mBodyFat, set: setMBodyFat },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs text-[#6b5a9e] mb-1 block">{f.label}</label>
                  <input type="number" step="0.1" value={f.val} onChange={e => f.set(e.target.value)}
                    placeholder="—"
                    className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveMeasurement} disabled={savingMeas}
                className="flex-1 py-2.5 rounded-xl bg-amber-400 text-[#0c0a1a] font-bold text-sm disabled:opacity-50">
                {savingMeas ? "Salvando..." : "Salva"}
              </button>
              <button onClick={() => setShowMeasForm(false)}
                className="px-4 py-2.5 rounded-xl border border-[#3b2d6e] text-[#6b5a9e] text-sm">
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Measurement history */}
        {measurements.length > 1 && !showMeasForm && (
          <div className="space-y-1.5 mt-2">
            {measurements.slice(1, 5).map(m => {
              const vals = [
                m.waist && `Vita ${m.waist}cm`,
                m.hips && `Fianchi ${m.hips}cm`,
                m.bodyFat && `${m.bodyFat}% grasso`,
              ].filter(Boolean).join(" · ");
              return (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--theme-surface)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#6b5a9e]">{fmt(m.date)}</p>
                    {vals && <p className="text-xs text-white truncate">{vals}</p>}
                  </div>
                  <button onClick={() => deleteMeasurement(m.id)} className="text-sm text-[#3b2d6e] hover:text-red-400">×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
