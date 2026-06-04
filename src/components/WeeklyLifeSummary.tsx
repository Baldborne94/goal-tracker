"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type SleepLog = { date: string; hours: number; quality: number };
type WorkoutDay = { date: string; exerciseCount: number; kcalBurned: number };
type Habit = { logs: { date: string }[] };
type FoodEntry = { kcal: number };

function weekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WeeklyLifeSummary() {
  const [workouts, setWorkouts] = useState<WorkoutDay[]>([]);
  const [sleep, setSleep] = useState<SleepLog[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [todayKcal, setTodayKcal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const today = toDateKey(new Date());
    Promise.all([
      fetch("/api/workout?history=true").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/sleep").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/routine").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/diet/food?date=${today}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([w, s, h, f]) => {
      setWorkouts(w);
      setSleep(s);
      setHabits(h);
      const kcal = (f as FoodEntry[]).reduce((sum: number, e: FoodEntry) => sum + e.kcal, 0);
      setTodayKcal(kcal);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  const ws = weekStart();
  const workoutsThisWeek = workouts.filter(w => w.date >= ws);
  const sleepThisWeek = sleep.filter(s => s.date >= ws);
  const avgSleep = sleepThisWeek.length > 0
    ? (sleepThisWeek.reduce((s, l) => s + l.hours, 0) / sleepThisWeek.length).toFixed(1)
    : null;

  // Days this week with ≥1 habit done
  const today = toDateKey(new Date());
  const thisWeekDates: string[] = [];
  const d = new Date(ws + "T12:00:00");
  while (toDateKey(d) <= today) {
    thisWeekDates.push(toDateKey(d));
    d.setDate(d.getDate() + 1);
  }
  const activeDays = thisWeekDates.filter(date =>
    habits.some((h: Habit) => h.logs.some((l: { date: string }) => l.date === date))
  ).length;

  const totalWorkoutKcal = workoutsThisWeek.reduce((s, w) => s + w.kcalBurned, 0);

  // Only show if there's meaningful data
  const hasData = workoutsThisWeek.length > 0 || avgSleep || activeDays > 0 || todayKcal > 0;
  if (!hasData) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">🌿 Riepilogo settimana</h2>
        <Link href="/vita" className="text-sm text-amber-400 font-medium">Vita →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {workoutsThisWeek.length > 0 && (
          <Link href="/workout" className="rounded-2xl border p-3 text-center block active:scale-95 transition-transform" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <p className="text-xl mb-0.5">🏋️</p>
            <p className="text-lg font-bold text-amber-400">{workoutsThisWeek.length}</p>
            <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>
              allenamenti{totalWorkoutKcal > 0 ? ` · ${totalWorkoutKcal} kcal` : ""}
            </p>
          </Link>
        )}
        {avgSleep && (
          <Link href="/sleep" className="rounded-2xl border p-3 text-center block active:scale-95 transition-transform" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <p className="text-xl mb-0.5">💤</p>
            <p className="text-lg font-bold text-amber-400">{avgSleep}h</p>
            <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>media sonno</p>
          </Link>
        )}
        {activeDays > 0 && (
          <Link href="/routine" className="rounded-2xl border p-3 text-center block active:scale-95 transition-transform" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <p className="text-xl mb-0.5">🔁</p>
            <p className="text-lg font-bold text-amber-400">{activeDays}/{thisWeekDates.length}</p>
            <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>giorni habit attive</p>
          </Link>
        )}
        {todayKcal > 0 && (
          <Link href="/diet" className="rounded-2xl border p-3 text-center block active:scale-95 transition-transform" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <p className="text-xl mb-0.5">🥗</p>
            <p className="text-lg font-bold text-amber-400">{todayKcal}</p>
            <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>kcal oggi</p>
          </Link>
        )}
      </div>
    </div>
  );
}
