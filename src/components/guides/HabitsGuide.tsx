"use client";

import { useEffect, useState } from "react";

type HabitLog = { id: string; date: string };
type Habit = { id: string; name: string; icon: string; logs: HabitLog[] };

type Props = {
  goalId: string;
  guideTarget: number | null;
  onProgressUpdate: (p: number) => void;
};

export default function HabitsGuide({ goalId, guideTarget, onProgressUpdate }: Props) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [totalDays, setTotalDays] = useState(0);
  const [target, setTarget] = useState(guideTarget ?? 30);
  const [progress, setProgress] = useState(0);
  const [today, setToday] = useState("");
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🔁");
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);

  async function reload() {
    const r = await fetch(`/api/goals/${goalId}/guide`);
    const d = await r.json();
    setHabits(d.habits ?? []);
    setTotalDays(d.totalDays ?? 0);
    setTarget(d.target ?? guideTarget ?? 30);
    setProgress(d.progress ?? 0);
    setToday(d.today ?? new Date().toISOString().slice(0, 10));
  }

  useEffect(() => { reload(); }, [goalId]);

  async function addHabit() {
    if (!newName.trim()) return;
    setAdding(true);
    const r = await fetch(`/api/goals/${goalId}/guide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitName: newName, habitIcon: newIcon }),
    });
    if (r.ok) {
      const d = await r.json();
      setHabits(d.habits ?? []);
      setProgress(d.progress ?? 0);
      onProgressUpdate(d.progress ?? 0);
      setNewName("");
      setNewIcon("🔁");
    }
    setAdding(false);
  }

  async function toggleCheck(habitId: string) {
    setChecking(habitId);
    const r = await fetch(`/api/goals/${goalId}/guide/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId }),
    });
    if (r.ok) {
      const d = await r.json();
      onProgressUpdate(d.progress);
      await reload();
    }
    setChecking(null);
  }

  return (
    <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-4">
      <h2 className="font-semibold text-[#c4b5fd] mb-4">🔁 Habits Guide</h2>

      <div className="bg-[#0f0d22] rounded-xl p-4 mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#9d8ac7]">Consistent days</span>
          <span className="font-bold text-green-400">{totalDays} / {target} days</span>
        </div>
        <div className="h-2.5 bg-[#1e1740] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-700 to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-right text-xs text-green-400/70 mt-1">{progress}% of goal</p>
      </div>

      {habits.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-[#6b5a9e] uppercase tracking-wider">Today&apos;s check-in</p>
          {habits.map((h) => {
            const checked = h.logs.some((l) => l.date === today);
            return (
              <button
                key={h.id}
                onClick={() => toggleCheck(h.id)}
                disabled={checking === h.id}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left active:scale-[0.98] ${
                  checked
                    ? "bg-green-900/20 border-green-700/40"
                    : "bg-[#0f0d22] border-[#2a1f50] hover:border-[#3b2d6e]"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                    checked ? "bg-green-500 border-green-500 text-black" : "border-[#3b2d6e]"
                  }`}
                >
                  {checked && (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm flex-1 ${checked ? "text-[#ede9ff]" : "text-[#9d8ac7]"}`}>
                  {h.icon} {h.name}
                </span>
                {checked && <span className="text-xs text-green-400 font-semibold">+5 XP ✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {habits.length === 0 && (
        <p className="text-xs text-[#6b5a9e] text-center py-2 mb-4">
          Add your first habit to start building the streak.
        </p>
      )}

      <div className="flex gap-2">
        <input
          value={newIcon}
          onChange={(e) => setNewIcon(e.target.value)}
          className="w-12 px-2 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-center text-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          maxLength={2}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addHabit()}
          placeholder="Add a habit..."
          className="flex-1 px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
        />
        <button
          onClick={addHabit}
          disabled={adding || !newName.trim()}
          className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-400 text-black rounded-xl font-semibold text-sm disabled:opacity-60 active:scale-95 transition-all"
        >
          {adding ? "..." : "+"}
        </button>
      </div>
    </div>
  );
}
