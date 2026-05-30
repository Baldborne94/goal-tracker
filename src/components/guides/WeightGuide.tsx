"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: string;
  weight: number;
  note: string | null;
  date: string;
};

type Props = {
  goalId: string;
  guideTarget: number | null;
  guideStart: number | null;
  onProgressUpdate: (p: number) => void;
};

export default function WeightGuide({ goalId, guideTarget, guideStart: initialStart, onProgressUpdate }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [start, setStart] = useState<number | null>(initialStart);
  const [current, setCurrent] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(guideTarget);
  const [progress, setProgress] = useState(0);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    const r = await fetch(`/api/goals/${goalId}/guide`);
    const d = await r.json();
    setEntries(d.entries ?? []);
    setStart(d.start ?? null);
    setCurrent(d.current ?? null);
    setTarget(d.target ?? guideTarget);
    setProgress(d.progress ?? 0);
  }

  useEffect(() => { reload(); }, [goalId]);

  async function log() {
    const val = parseFloat(weight);
    if (!weight || isNaN(val)) return;
    setSaving(true);
    const r = await fetch(`/api/goals/${goalId}/guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: val, note }),
    });
    if (r.ok) {
      const d = await r.json();
      setEntries(d.entries ?? []);
      setStart(d.start ?? null);
      setCurrent(d.current ?? null);
      setProgress(d.progress ?? 0);
      onProgressUpdate(d.progress ?? 0);
      setWeight("");
      setNote("");
    }
    setSaving(false);
  }

  const isLosing = target !== null && start !== null && target < start;

  return (
    <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-4">
      <h2 className="font-semibold text-[#c4b5fd] mb-4">⚖️ Weight Guide</h2>

      {start !== null && target !== null && (
        <div className="bg-[#0f0d22] rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[#9d8ac7]">
              Current: <span className="text-[#ede9ff] font-semibold">{current ?? start} kg</span>
            </span>
            <span className="font-bold text-violet-400">
              {isLosing ? "↓" : "↑"} Target: {target} kg
            </span>
          </div>
          <div className="h-2.5 bg-[#1e1740] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-700 to-violet-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#4a3a7a] mt-1">
            <span>Start: {start} kg</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}

      {start === null && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl px-3 py-2 mb-4">
          <p className="text-xs text-amber-400/80">Log your starting weight below to begin tracking progress.</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && log()}
          placeholder="kg"
          step="0.1"
          className="w-24 px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && log()}
          placeholder="Note (optional)"
          className="flex-1 px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
        <button
          onClick={log}
          disabled={saving || !weight}
          className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-violet-400 text-white rounded-xl font-semibold text-sm disabled:opacity-60 active:scale-95 transition-all"
        >
          {saving ? "..." : "Log"}
        </button>
      </div>

      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[#6b5a9e] uppercase tracking-wider">Recent entries</p>
          {entries.slice(0, 6).map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between bg-[#0f0d22] rounded-xl px-3 py-2 border border-[#2a1f50]"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#ede9ff]">{e.weight} kg</span>
                {e.note && <span className="text-xs text-[#6b5a9e]">{e.note}</span>}
              </div>
              <span className="text-xs text-[#4a3a7a]">
                {new Date(e.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
