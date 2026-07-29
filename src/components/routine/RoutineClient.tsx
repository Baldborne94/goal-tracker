"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { dayKey } from "@/lib/utils";

type HabitLog = { id: string; date: string };
type Habit = {
  id: string;
  name: string;
  icon: string;
  logs: HabitLog[];
};

const PRESET_ICONS = [
  "🏃", "💪", "📚", "🧘", "💧", "🥗", "😴", "✍️",
  "🎸", "🏋️", "🚴", "🧹", "🥤", "🌙", "🧠", "🎯",
];

function HabitHeatmap({ habits }: { habits: { name: string; icon: string; logs: { date: string }[] }[] }) {
  const weeks = 12;
  const days = weeks * 7;
  const today = new Date();
  const totalHabits = habits.length;

  const grid = useMemo(() => {
    const cells: { date: string; count: number; total: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = dayKey(d);
      const count = habits.filter((h) => h.logs.some((l) => l.date === dateStr)).length;
      cells.push({ date: dateStr, count, total: totalHabits });
    }
    return cells;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits]);

  if (totalHabits === 0) return null;

  function cellColor(count: number, total: number) {
    if (total === 0 || count === 0) return "rgba(59,45,110,0.4)";
    const pct = count / total;
    if (pct >= 1) return "#f59e0b";
    if (pct >= 0.6) return "#d97706";
    if (pct >= 0.3) return "#92400e";
    return "#451a03";
  }

  const monthLabels: { label: string; colIndex: number }[] = [];
  grid.forEach(({ date }, i) => {
    if (i % 7 === 0) {
      const m = new Date(date).toLocaleDateString("it-IT", { month: "short" });
      const weekIdx = Math.floor(i / 7);
      if (monthLabels.length === 0 || monthLabels[monthLabels.length - 1].label !== m) {
        monthLabels.push({ label: m, colIndex: weekIdx });
      }
    }
  });

  return (
    <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4">
      <p className="text-xs font-semibold text-[#9d8ac7] uppercase tracking-wider mb-3">🗓 Heatmap 12 settimane</p>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${weeks * 14}px` }}>
          <div className="flex gap-0.5 mb-1">
            {Array.from({ length: weeks }).map((_, wi) => {
              const label = monthLabels.find((m) => m.colIndex === wi);
              return (
                <div key={wi} className="flex-1 text-center" style={{ minWidth: 12 }}>
                  {label && <span className="text-[9px] text-[#6b5a9e]">{label.label}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: weeks }).map((_, wi) => (
              <div key={wi} className="flex flex-col gap-0.5 flex-1">
                {grid.slice(wi * 7, wi * 7 + 7).map((cell) => (
                  <div
                    key={cell.date}
                    className="rounded-sm"
                    style={{ height: 11, backgroundColor: cellColor(cell.count, cell.total) }}
                    title={`${cell.date}: ${cell.count}/${cell.total} abitudini`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-[9px] text-[#6b5a9e]">Meno</span>
        {[0, 0.3, 0.6, 1].map((pct) => (
          <div key={pct} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cellColor(pct > 0 ? 1 : 0, pct > 0 ? 1 / pct : 1) }} />
        ))}
        <span className="text-[9px] text-[#6b5a9e]">Di più</span>
      </div>
    </div>
  );
}

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const start = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  if (!start) return 0;
  let streak = 0;
  const d = new Date(start);
  while (set.has(dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function todayStr() {
  return dayKey();
}

function formatDate(d: Date) {
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function RoutineClient() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🔁");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const today = todayStr();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/routine");
      if (res.ok) setHabits(await res.json());
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const doneToday = habits.filter((h) =>
    h.logs.some((l) => l.date === today)
  ).length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((doneToday / total) * 100) : 0;

  async function toggleCheck(habit: Habit) {
    setToggling(habit.id);
    try {
      const res = await fetch(`/api/routine/${habit.id}/check`, {
        method: "POST",
      });
      if (!res.ok) return;
      const { checked } = await res.json();
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== habit.id) return h;
          if (checked) {
            return { ...h, logs: [...h.logs, { id: "tmp", date: today }] };
          } else {
            return { ...h, logs: h.logs.filter((l) => l.date !== today) };
          }
        })
      );
      if (checked) {
        setMsg("+5 XP!");
        setTimeout(() => setMsg(""), 2000);
      }
    } finally {
      setToggling(null);
    }
  }

  async function deleteHabit(id: string) {
    await fetch(`/api/routine/${id}`, { method: "DELETE" });
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  async function saveHabit() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon }),
      });
      if (res.ok) {
        const habit = await res.json();
        setHabits((prev) => [...prev, habit]);
        setNewName("");
        setNewIcon("🔁");
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/vita" className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold flex-shrink-0" style={{ background: "var(--theme-surface)", color: "var(--theme-text-muted)" }}>‹</Link>
          <div>
            <h1 className="text-xl font-bold text-amber-400">🔁 Abitudini</h1>
            <p className="text-xs text-[#6b5a9e] capitalize">{formatDate(new Date())}</p>
          </div>
        </div>
        {msg && (
          <span className="text-xs bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full font-medium">
            {msg}
          </span>
        )}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-medium">
              Oggi: {doneToday}/{total} completati
            </span>
            <span
              className={`text-sm font-bold ${pct === 100 ? "text-amber-400" : "text-[#6b5a9e]"}`}
            >
              {pct === 100 ? "✨ Perfetto!" : `${pct}%`}
            </span>
          </div>
          <div className="h-2 bg-[#0c0a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {total === 0 && !showForm && (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-6 text-center space-y-2">
          <p className="text-3xl">🌱</p>
          <p className="text-white font-medium">Nessuna abitudine</p>
          <p className="text-xs text-[#6b5a9e]">
            Crea la tua prima abitudine per guadagnare XP ogni giorno
          </p>
        </div>
      )}

      {/* Habits list */}
      {habits.map((habit) => {
        const checked = habit.logs.some((l) => l.date === today);
        const streak = calcStreak(habit.logs.map((l) => l.date));
        return (
          <div
            key={habit.id}
            className="bg-[#16112e] border border-[#3b2d6e] rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <span className="text-2xl">{habit.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{habit.name}</p>
              {streak > 0 && (
                <p className="text-xs text-orange-400">🔥 {streak} giorni di fila</p>
              )}
            </div>
            <button
              onClick={() => deleteHabit(habit.id)}
              className="text-[#3b2d6e] hover:text-red-400 transition-colors text-lg leading-none px-1"
              aria-label="Elimina"
            >
              ×
            </button>
            <button
              onClick={() => toggleCheck(habit)}
              disabled={toggling === habit.id}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
                checked
                  ? "bg-amber-400 border-amber-400 text-[#0c0a1a]"
                  : "border-[#3b2d6e] text-transparent"
              } ${toggling === habit.id ? "opacity-50" : ""}`}
              aria-label={checked ? "Deseleziona" : "Segna fatto"}
            >
              {checked && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          </div>
        );
      })}

      {/* Heatmap */}
      {habits.length > 0 && <HabitHeatmap habits={habits} />}

      {/* Add button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl bg-amber-400 text-[#0c0a1a] font-bold text-sm active:scale-95 transition-transform"
        >
          + Aggiungi abitudine
        </button>
      ) : (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">Nuova abitudine</p>

          <div>
            <label className="text-xs text-[#6b5a9e] mb-1 block">Nome *</label>
            <input
              type="text"
              placeholder="es. Bevi 2L d'acqua"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-[#6b5a9e] mb-2 block">Icona</label>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  className={`h-9 rounded-lg text-xl flex items-center justify-center transition-all ${
                    newIcon === icon
                      ? "bg-amber-400/30 border border-amber-400"
                      : "bg-[#0c0a1a] border border-[#3b2d6e]"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveHabit}
              disabled={saving || !newName.trim()}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 text-[#0c0a1a] font-bold text-sm disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salva"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewName("");
                setNewIcon("🔁");
              }}
              className="px-4 py-2.5 rounded-xl border border-[#3b2d6e] text-[#6b5a9e] text-sm"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
