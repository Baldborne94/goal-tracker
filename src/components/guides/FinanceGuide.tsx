"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: string;
  amount: number;
  description: string | null;
  date: string;
};

type Props = {
  goalId: string;
  guideTarget: number | null;
  onProgressUpdate: (p: number) => void;
};

export default function FinanceGuide({ goalId, guideTarget, onProgressUpdate }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState(0);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    const r = await fetch(`/api/goals/${goalId}/guide`);
    const d = await r.json();
    setEntries(d.entries ?? []);
    setTotal(d.total ?? 0);
    setProgress(d.progress ?? 0);
  }

  useEffect(() => { reload(); }, [goalId]);

  async function log() {
    const val = parseFloat(amount);
    if (!amount || val <= 0) return;
    setSaving(true);
    const r = await fetch(`/api/goals/${goalId}/guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: val, description: desc }),
    });
    if (r.ok) {
      const d = await r.json();
      setEntries(d.entries ?? []);
      setTotal(d.total ?? 0);
      setProgress(d.progress ?? 0);
      onProgressUpdate(d.progress ?? 0);
      setAmount("");
      setDesc("");
    }
    setSaving(false);
  }

  const target = guideTarget ?? 0;

  return (
    <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-4">
      <h2 className="font-semibold text-[#c4b5fd] mb-4">💰 Finance Guide</h2>

      <div className="bg-[#0f0d22] rounded-xl p-4 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#9d8ac7]">Saved</span>
          <span className="font-bold text-amber-400">
            €{total.toFixed(2)} / €{target.toFixed(2)}
          </span>
        </div>
        <div className="h-2.5 bg-[#1e1740] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-right text-xs text-amber-400/70 mt-1">{progress}% of goal</p>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && log()}
          placeholder="€ amount"
          min="0"
          step="0.01"
          className="w-28 px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && log()}
          placeholder="Note (optional)"
          className="flex-1 px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />
        <button
          onClick={log}
          disabled={saving || !amount}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl font-semibold text-sm disabled:opacity-60 active:scale-95 transition-all"
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
                <span className="text-sm font-semibold text-amber-400">+€{e.amount.toFixed(2)}</span>
                {e.description && (
                  <span className="text-xs text-[#6b5a9e]">{e.description}</span>
                )}
              </div>
              <span className="text-xs text-[#4a3a7a]">
                {new Date(e.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-xs text-[#6b5a9e] text-center py-2">
          Log your first savings entry to start tracking.
        </p>
      )}
    </div>
  );
}
