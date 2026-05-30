"use client";

import { useState, useEffect, useCallback } from "react";

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

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const start = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  if (!start) return 0;
  let streak = 0;
  const d = new Date(start);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
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

  const doneToday = habits.filter((h) => h.logs.some((l) => l.date === today)).length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((doneToday / total) * 100) : 0;

  async function toggleCheck(habit: Habit) {
    setToggling(habit.id);
    try {
      const res = await fetch(`/api/routine/${habit.id}/check`, { method: "POST" });
      if (!res.ok) return;
      const { checked } = await res.json();
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== habit.id) return h;
          if (checked) return { ...h, logs: [...h.logs, { id: "tmp", date: today }] };
          return { ...h, logs: h.logs.filter((l) => l.date !== today) };
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-amber-400">🔁 Habits</h1>
          <p className="text-xs text-[#6b5a9e] capitalize">{formatDate(new Date())}</p>
        </div>
        {msg && (
          <span className="text-xs bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full font-medium">
            {msg}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-medium">Today: {doneToday}/{total} done</span>
            <span className={`text-sm font-bold ${pct === 100 ? "text-amber-400" : "text-[#6b5a9e]"}`}>
              {pct === 100 ? "✨ Perfect!" : `${pct}%`}
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

      {total === 0 && !showForm && (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-6 text-center space-y-2">
          <p className="text-3xl">🌱</p>
          <p className="text-white font-medium">No habits yet</p>
          <p className="text-xs text-[#6b5a9e]">Create your first habit to earn XP every day</p>
        </div>
      )}

      {habits.map((habit) => {
        const checked = habit.logs.some((l) => l.date === today);
        const streak = calcStreak(habit.logs.map((l) => l.date));
        return (
          <div key={habit.id} className="bg-[#16112e] border border-[#3b2d6e] rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">{habit.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm">{habit.name}</p>
              {streak > 0 && <p className="text-xs text-orange-400">🔥 {streak} day streak</p>}
            </div>
            <button
              onClick={() => deleteHabit(habit.id)}
              className="text-[#3b2d6e] hover:text-red-400 transition-colors text-lg leading-none px-1"
              aria-label="Delete"
            >
              ×
            </button>
            <button
              onClick={() => toggleCheck(habit)}
              disabled={toggling === habit.id}
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
                checked ? "bg-amber-400 border-amber-400 text-[#0c0a1a]" : "border-[#3b2d6e] text-transparent"
              } ${toggling === habit.id ? "opacity-50" : ""}`}
              aria-label={checked ? "Uncheck" : "Mark done"}
            >
              {checked && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          </div>
        );
      })}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl bg-amber-400 text-[#0c0a1a] font-bold text-sm active:scale-95 transition-transform"
        >
          + Add habit
        </button>
      ) : (
        <div className="bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-white">New habit</p>

          <div>
            <label className="text-xs text-[#6b5a9e] mb-1 block">Name *</label>
            <input
              type="text"
              placeholder="e.g. Drink 2L of water"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-[#0c0a1a] border border-[#3b2d6e] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-[#6b5a9e] mb-2 block">Icon</label>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setNewIcon(icon)}
                  className={`h-9 rounded-lg text-xl flex items-center justify-center transition-all ${
                    newIcon === icon ? "bg-amber-400/30 border border-amber-400" : "bg-[#0c0a1a] border border-[#3b2d6e]"
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
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewName(""); setNewIcon("🔁"); }}
              className="px-4 py-2.5 rounded-xl border border-[#3b2d6e] text-[#6b5a9e] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
