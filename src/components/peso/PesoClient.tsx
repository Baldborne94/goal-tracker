"use client";

import { useState, useEffect, useCallback } from "react";

type WeightEntry = {
  id: string;
  weight: number;
  note: string | null;
  date: string;
};

function fmt(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
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

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/peso");
      if (res.ok) setEntries(await res.json());
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        setMsg("+10 XP guadagnati!");
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
        <div>
          <h1 className="text-xl font-bold text-amber-400">⚖️ Corpo</h1>
          <p className="text-xs text-[#6b5a9e]">Traccia il tuo peso nel tempo</p>
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
                  className={`text-sm font-semibold ${
                    deltaLast < 0
                      ? "text-green-400"
                      : deltaLast > 0
                        ? "text-red-400"
                        : "text-[#6b5a9e]"
                  }`}
                >
                  {deltaLast > 0 ? "+" : ""}
                  {deltaLast.toFixed(1)} kg vs prec.
                </span>
              )}
              {deltaStart !== null && (
                <span
                  className={`text-xs ${
                    deltaStart < 0
                      ? "text-green-500"
                      : deltaStart > 0
                        ? "text-red-400"
                        : "text-[#6b5a9e]"
                  }`}
                >
                  {deltaStart > 0 ? "+" : ""}
                  {deltaStart.toFixed(1)} kg dall&apos;inizio
                </span>
              )}
            </div>
          </div>

          <WeightChart entries={sorted.slice(-20)} />

          {sorted.length < 2 && (
            <p className="text-xs text-[#6b5a9e] text-center">
              Registra almeno 2 misurazioni per vedere il grafico
            </p>
          )}
        </div>
      )}

      {!latest && (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-6 text-center space-y-2">
          <p className="text-3xl">⚖️</p>
          <p className="text-white font-medium">Nessuna misurazione ancora</p>
          <p className="text-xs text-[#6b5a9e]">
            Inizia a tracciare il tuo peso per guadagnare XP e badge
          </p>
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl bg-amber-400 text-[#0c0a1a] font-bold text-sm active:scale-95 transition-transform"
        >
          + Registra peso
        </button>
      ) : (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuova misurazione</p>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-[#6b5a9e] mb-1 block">Peso (kg) *</label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                placeholder="es. 82.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-[#6b5a9e] mb-1 block">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#6b5a9e] mb-1 block">Nota (opzionale)</label>
            <input
              type="text"
              placeholder="es. dopo allenamento"
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
              {saving ? "Salvataggio..." : "Salva"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setWeight("");
                setNote("");
              }}
              className="px-4 py-2.5 rounded-xl border border-[#3b2d6e] text-[#6b5a9e] text-sm"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {recentDesc.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#6b5a9e] uppercase tracking-wider px-1">
            Storico
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
                    <span className="text-xs text-[#6b5a9e] truncate">{e.note}</span>
                  )}
                </div>
                <p className="text-xs text-[#6b5a9e]">{fmt(e.date)}</p>
              </div>
              <button
                onClick={() => deleteEntry(e.id)}
                className="text-[#3b2d6e] hover:text-red-400 transition-colors text-lg leading-none"
                aria-label="Elimina"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
