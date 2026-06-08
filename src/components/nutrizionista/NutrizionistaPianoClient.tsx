"use client";

import { useState, useEffect } from "react";
import {
  WEEKLY_PLAN, getDayPlan, MEAL_ICONS, MEAL_REMINDERS, MEAL_ORDER,
  type MealTime, type DayPlan,
} from "@/lib/meal-plan";
import { cn } from "@/lib/utils";

type Completion = { id: string; date: string; meal: string };
type Tab = "oggi" | "settimana" | "note";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function NutrizionistaPianoClient() {
  const [tab, setTab] = useState<Tab>("oggi");
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const todayStr = toDateStr(today);

  const viewBase = new Date(today);
  viewBase.setDate(today.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(viewBase);
  const weekFrom = toDateStr(weekDates[0]);
  const weekTo = toDateStr(weekDates[6]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/nutrizionista/completions?from=${weekFrom}&to=${weekTo}`)
      .then(r => r.json())
      .then(data => {
        const set = new Set<string>(
          (data.completions as Completion[] || []).map(c => `${c.date}:${c.meal}`)
        );
        setCompletions(set);
      })
      .finally(() => setLoading(false));
  }, [weekFrom, weekTo]);

  const isCompleted = (date: string, meal: string) => completions.has(`${date}:${meal}`);

  const toggleMeal = async (date: string, meal: string) => {
    const key = `${date}:${meal}`;
    setToggling(key);
    setCompletions(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    try {
      await fetch("/api/nutrizionista/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, meal }),
      });
    } catch {
      setCompletions(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    }
    setToggling(null);
  };

  const todayDayPlan = getDayPlan(today);
  const todayCompleted = MEAL_ORDER.filter(m => isCompleted(todayStr, m)).length;

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-amber-400">🥗 Piano Nutrizionista</h1>
        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Dott.ssa Michela Audiello</p>
      </div>

      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--theme-surface)" }}>
        {(["oggi", "settimana", "note"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
              tab === t ? "text-amber-400" : "text-gray-500"
            )}
            style={tab === t ? { background: "var(--theme-bg)" } : {}}
          >
            {t === "oggi" ? "Oggi" : t === "settimana" ? "Settimana" : "Note"}
          </button>
        ))}
      </div>

      {tab === "oggi" && (
        <OggiView
          today={today}
          todayStr={todayStr}
          dayPlan={todayDayPlan}
          isCompleted={isCompleted}
          toggleMeal={toggleMeal}
          toggling={toggling}
          todayCompleted={todayCompleted}
          loading={loading}
        />
      )}

      {tab === "settimana" && (
        <SettimanaView
          weekDates={weekDates}
          today={today}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          isCompleted={isCompleted}
        />
      )}

      {tab === "note" && <NoteView />}
    </div>
  );
}

// ---- Oggi ----

function OggiView({
  today, todayStr, dayPlan, isCompleted, toggleMeal, toggling, todayCompleted, loading,
}: {
  today: Date;
  todayStr: string;
  dayPlan: DayPlan;
  isCompleted: (date: string, meal: string) => boolean;
  toggleMeal: (date: string, meal: string) => void;
  toggling: string | null;
  todayCompleted: number;
  loading: boolean;
}) {
  const dayLabel = today.toLocaleDateString("it-IT", { weekday: "long" });
  const dateLabel = today.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 space-y-2" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <p className="font-bold text-white capitalize">{dayLabel}, {dateLabel}</p>
        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
          {todayCompleted} / 4 pasti completati
        </p>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--theme-bg)" }}>
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${(todayCompleted / 4) * 100}%` }}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-center py-8 text-sm text-gray-500">Caricamento…</p>
      ) : (
        dayPlan.meals.map(meal => (
          <MealCard
            key={meal.time}
            meal={meal}
            dateStr={todayStr}
            done={isCompleted(todayStr, meal.time)}
            onToggle={toggleMeal}
            isToggling={toggling === `${todayStr}:${meal.time}`}
          />
        ))
      )}
    </div>
  );
}

// ---- MealCard ----

function MealCard({
  meal, dateStr, done, onToggle, isToggling,
}: {
  meal: DayPlan["meals"][0];
  dateStr: string;
  done: boolean;
  onToggle: (date: string, meal: string) => void;
  isToggling: boolean;
}) {
  return (
    <div
      className={cn("rounded-2xl border p-4 transition-all", done && "border-green-500/40")}
      style={{
        background: done ? "rgba(34,197,94,0.05)" : "var(--theme-surface)",
        borderColor: done ? undefined : "var(--theme-surface-border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{MEAL_ICONS[meal.time]}</span>
          <div>
            <p className={cn("font-semibold text-sm", done ? "text-green-400" : "text-white")}>
              {meal.label}
            </p>
            <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
              {MEAL_REMINDERS[meal.time]}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggle(dateStr, meal.time)}
          disabled={isToggling}
          className={cn(
            "w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all active:scale-90",
            done
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-600 hover:border-green-500/50"
          )}
        >
          {done ? "✓" : ""}
        </button>
      </div>

      <div className={cn("space-y-1.5 transition-opacity", done && "opacity-50")}>
        {meal.foods.map((food, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-0.5 border-b border-white/5 last:border-0">
            <span style={{ color: "var(--theme-text)" }}>{food.name}</span>
            <span className="font-semibold text-amber-400/80 ml-4 shrink-0">{food.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Settimana ----

function SettimanaView({
  weekDates, today, weekOffset, setWeekOffset, isCompleted,
}: {
  weekDates: Date[];
  today: Date;
  weekOffset: number;
  setWeekOffset: (n: number) => void;
  isCompleted: (date: string, meal: string) => boolean;
}) {
  const todayStr = toDateStr(today);
  const weekStart = weekDates[0].toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  const weekEnd = weekDates[6].toLocaleDateString("it-IT", { day: "numeric", month: "short" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ color: "var(--theme-text-muted)" }}
        >
          ‹ Prec
        </button>
        <span className="text-sm font-medium" style={{ color: "var(--theme-text)" }}>
          {weekStart} – {weekEnd}
        </span>
        <button
          onClick={() => setWeekOffset(weekOffset + 1)}
          disabled={weekOffset >= 0}
          className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30"
          style={{ color: "var(--theme-text-muted)" }}
        >
          Succ ›
        </button>
      </div>

      {weekDates.map(d => {
        const ds = toDateStr(d);
        const isToday = ds === todayStr;
        const dayName = d.toLocaleDateString("it-IT", { weekday: "short" });
        const dayNum = d.getDate();
        const mealsDone = MEAL_ORDER.filter(m => isCompleted(ds, m)).length;

        return (
          <div
            key={ds}
            className={cn("rounded-2xl border p-3 flex items-center gap-3", isToday && "border-amber-500/40")}
            style={{
              background: isToday ? "rgba(245,158,11,0.05)" : "var(--theme-surface)",
              borderColor: isToday ? undefined : "var(--theme-surface-border)",
            }}
          >
            <div className="text-center w-10 shrink-0">
              <p className={cn("text-xs capitalize font-medium", isToday ? "text-amber-400" : "text-gray-400")}>
                {dayName}
              </p>
              <p className={cn("text-lg font-bold leading-tight", isToday ? "text-amber-400" : "text-white")}>
                {dayNum}
              </p>
            </div>

            <div className="flex-1 flex gap-1">
              {MEAL_ORDER.map(meal => (
                <div key={meal} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-sm">{MEAL_ICONS[meal]}</span>
                  <div className={cn("w-2.5 h-2.5 rounded-full", isCompleted(ds, meal) ? "bg-green-500" : "bg-gray-700")} />
                </div>
              ))}
            </div>

            <div className="text-right shrink-0 w-8">
              <p className={cn("text-sm font-bold", mealsDone === 4 ? "text-green-400" : "text-gray-500")}>
                {mealsDone}/4
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Note ----

function NoteView() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <p className="font-semibold text-amber-400 mb-3">📋 Piano settimanale</p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
          La settimana si ripete per 4 settimane consecutive. Ogni giorno ha 4 momenti
          alimentari: colazione (08:30), spuntino (10:30), pranzo (13:00) e merenda (16:30).
        </p>
      </div>

      <div className="rounded-2xl border p-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <p className="font-semibold text-amber-400 mb-3">💡 Consigli generali</p>
        <ul className="text-xs space-y-2" style={{ color: "var(--theme-text-muted)" }}>
          <li>• Rispetta gli orari indicati per i pasti</li>
          <li>• Bevi almeno 2 litri d'acqua al giorno</li>
          <li>• Pesa gli alimenti a crudo</li>
          <li>• Non saltare i pasti, soprattutto la colazione</li>
          <li>• In caso di dubbi, contatta la nutrizionista</li>
        </ul>
      </div>

      <div className="rounded-2xl border p-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <p className="font-semibold text-amber-400 mb-2">📄 Documenti</p>
        <p className="text-xs mb-3" style={{ color: "var(--theme-text-muted)" }}>
          Schede e documenti ricevuti dalla nutrizionista.
        </p>
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--theme-bg)" }}>
          <span className="text-2xl">📑</span>
          <div>
            <p className="text-sm text-white font-medium">Piano alimentare mensile</p>
            <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Dott.ssa Michela Audiello · 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
}
