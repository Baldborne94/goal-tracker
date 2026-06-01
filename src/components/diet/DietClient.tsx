"use client";

import { useState } from "react";

const MEALS = [
  { type: "breakfast",  icon: "🌅", label: "Breakfast",        time: "08:00" },
  { type: "snack_am",   icon: "🍎", label: "Morning snack",    time: "10:30" },
  { type: "lunch",      icon: "☀️",  label: "Lunch",            time: "13:00" },
  { type: "snack_pm",   icon: "🍊", label: "Afternoon snack",  time: "16:30" },
  { type: "dinner",     icon: "🌙", label: "Dinner",           time: "20:00" },
];

type MealLog = { id: string; date: string; mealType: string; text: string; notes: string | null };
type WeightEntry = { id: string; weight: number; date: string };

type Props = {
  initialDate: string;
  initialLogs: MealLog[];
  recentWeights: WeightEntry[];
};

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string) {
  const today = toDateKey(new Date());
  const yest = toDateKey(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Today";
  if (dateStr === yest) return "Yesterday";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function DietClient({ initialDate, initialLogs, recentWeights: initialWeights }: Props) {
  const [date, setDate] = useState(initialDate);
  const [logs, setLogs] = useState<MealLog[]>(initialLogs);
  const [weights, setWeights] = useState<WeightEntry[]>(initialWeights);
  const [loadingDate, setLoadingDate] = useState(false);

  // Meal form
  const [showMealForm, setShowMealForm] = useState(false);
  const [formMealType, setFormMealType] = useState("");
  const [formText, setFormText] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Weight form
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  async function changeDate(delta: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    const newDate = toDateKey(d);
    if (newDate > toDateKey(new Date())) return; // no future
    setLoadingDate(true);
    const res = await fetch(`/api/diet/logs?date=${newDate}`);
    if (res.ok) {
      setLogs(await res.json());
      setDate(newDate);
    }
    setLoadingDate(false);
  }

  function openMealForm(mealType: string) {
    const existing = logs.find(l => l.mealType === mealType);
    setFormMealType(mealType);
    setFormText(existing?.text ?? "");
    setFormNotes(existing?.notes ?? "");
    setShowMealForm(true);
  }

  async function saveMeal() {
    if (!formText.trim()) return;
    setFormSaving(true);
    const res = await fetch("/api/diet/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mealType: formMealType, text: formText, notes: formNotes }),
    });
    if (res.ok) {
      const saved = await res.json();
      setLogs(prev => {
        const without = prev.filter(l => l.mealType !== formMealType);
        return [...without, saved];
      });
      setShowMealForm(false);
    }
    setFormSaving(false);
  }

  async function deleteMeal(id: string) {
    const res = await fetch(`/api/diet/logs/${id}`, { method: "DELETE" });
    if (res.ok) setLogs(prev => prev.filter(l => l.id !== id));
  }

  async function saveWeight() {
    const val = parseFloat(weightInput);
    if (!weightInput || isNaN(val) || val <= 0) return;
    setSavingWeight(true);
    const res = await fetch("/api/peso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: val, date }),
    });
    if (res.ok) {
      const entry = await res.json();
      setWeights(prev => [entry, ...prev].slice(0, 14));
      setWeightInput("");
    }
    setSavingWeight(false);
  }

  const todayWeight = weights.find(w => w.date.slice(0, 10) === date);
  const loggedCount = logs.length;
  const isToday = date === toDateKey(new Date());

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28">
      {/* Header */}
      <h1 className="text-xl font-bold text-[#ede9ff] mb-6">🥗 Diet tracker</h1>

      {/* Date navigation */}
      <div className="flex items-center justify-between rounded-2xl border px-4 py-3 mb-5" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <button onClick={() => changeDate(-1)} disabled={loadingDate} className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold disabled:opacity-40" style={{ color: "var(--theme-text-muted)" }}>‹</button>
        <div className="text-center">
          <p className="font-semibold text-[#ede9ff] text-sm">{formatDateLabel(date)}</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday || loadingDate} className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold disabled:opacity-30" style={{ color: "var(--theme-text-muted)" }}>›</button>
      </div>

      {/* Weight entry */}
      <div className="rounded-2xl border p-4 mb-5" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#ede9ff]">⚖️ Weight</p>
            {todayWeight ? (
              <p className="text-xl font-bold text-amber-400">{todayWeight.weight} kg</p>
            ) : (
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Not logged yet</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveWeight()}
              placeholder="e.g. 72.5"
              step="0.1"
              min="0"
              className="w-24 px-3 py-2 rounded-xl text-sm text-[#ede9ff] placeholder-[#4a3a7a] focus:outline-none focus:ring-2 focus:ring-amber-500/40 border"
              style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
            />
            <button
              onClick={saveWeight}
              disabled={savingWeight || !weightInput}
              className="px-3 py-2 bg-amber-500 text-black rounded-xl text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
            >
              {savingWeight ? "..." : "Log"}
            </button>
          </div>
        </div>

        {/* Mini weight trend */}
        {weights.length >= 2 && (
          <div className="mt-3 flex items-end gap-1.5 h-10">
            {[...weights].reverse().slice(-10).map((w, i, arr) => {
              const vals = arr.map(x => x.weight);
              const min = Math.min(...vals);
              const max = Math.max(...vals);
              const range = max - min || 1;
              const h = 8 + ((w.weight - min) / range) * 28;
              const isLast = i === arr.length - 1;
              return (
                <div key={w.id} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-t-sm transition-all ${isLast ? "bg-amber-400" : "bg-violet-600/60"}`}
                    style={{ height: `${h}px` }}
                  />
                  {isLast && (
                    <span className="text-[8px] text-amber-400 font-bold">{w.weight}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress badge */}
      {loggedCount > 0 && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl" style={{ background: "var(--theme-bg)" }}>
          <span className="text-sm">{loggedCount === 5 ? "🌟" : "✅"}</span>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
            {loggedCount === 5 ? "All meals logged for today!" : `${loggedCount}/5 meals logged`}
          </p>
        </div>
      )}

      {/* Meal slots */}
      <div className="space-y-2.5">
        {MEALS.map(meal => {
          const log = logs.find(l => l.mealType === meal.type);
          return (
            <div
              key={meal.type}
              className="rounded-2xl border p-4 cursor-pointer active:scale-[0.98] transition-all"
              style={{ background: "var(--theme-surface)", borderColor: log ? "var(--theme-accent)" : "var(--theme-surface-border)", opacity: loadingDate ? 0.6 : 1 }}
              onClick={() => openMealForm(meal.type)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{meal.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold text-[#ede9ff]">{meal.label}</p>
                    <span className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{meal.time}</span>
                  </div>
                  {log ? (
                    <>
                      <p className="text-sm text-[#ede9ff] leading-snug">{log.text}</p>
                      {log.notes && <p className="text-xs mt-0.5" style={{ color: "var(--theme-text-muted)" }}>{log.notes}</p>}
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Tap to log what you ate</p>
                  )}
                </div>
                {log && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteMeal(log.id); }}
                    className="text-lg leading-none flex-shrink-0 hover:text-red-400 transition-colors"
                    style={{ color: "var(--theme-surface-border)" }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Meal log bottom sheet */}
      {showMealForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[60]" onClick={() => setShowMealForm(false)}>
          <div
            className="rounded-t-2xl border w-full max-w-lg px-5 pt-5 pb-10"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const meal = MEALS.find(m => m.type === formMealType)!;
              return (
                <>
                  <h3 className="font-bold text-[#ede9ff] mb-1">{meal.icon} {meal.label}</h3>
                  <p className="text-xs mb-4" style={{ color: "var(--theme-text-muted)" }}>What did you eat?</p>
                  <textarea
                    rows={3}
                    value={formText}
                    onChange={e => setFormText(e.target.value)}
                    placeholder="e.g. Oatmeal with berries and honey"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 border resize-none mb-2"
                    style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                  />
                  <input
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Notes (optional — how you felt, quantity...)"
                    className="w-full px-3 py-2.5 rounded-xl text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 border mb-4"
                    style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                  />
                  <div className="flex gap-3">
                    <button onClick={() => setShowMealForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>Cancel</button>
                    <button onClick={saveMeal} disabled={formSaving || !formText.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all">
                      {formSaving ? "..." : "Save"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
