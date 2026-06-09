"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  getDayPlan, MEAL_ICONS, MEAL_REMINDERS, MEAL_ORDER,
  type MealTime, type DayPlan,
} from "@/lib/meal-plan";
import { cn } from "@/lib/utils";

type Completion = { id: string; date: string; meal: string };
type Doc = { id: string; title: string; mimeType: string; size: number; createdAt: string };
type Tab = "oggi" | "settimana" | "note";

function toDateStr(d: Date) {
  // Use the LOCAL calendar date, not UTC. toISOString() converts to UTC, which
  // near midnight rolls the date to the previous/next day and makes meal checks
  // land under the wrong weekday in the grid (which is built in local time).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

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
      {/* Header with back arrow */}
      <div className="flex items-center gap-3">
        <Link
          href="/vita"
          className="flex items-center justify-center w-9 h-9 rounded-xl border transition-all active:scale-90"
          style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold text-amber-400">🥗 Piano Nutrizionista</h1>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Dott.ssa Michela Audiello</p>
        </div>
      </div>

      {/* Tabs */}
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
        selectedDate ? (
          <DayView
            date={selectedDate}
            dateStr={toDateStr(selectedDate)}
            dayPlan={getDayPlan(selectedDate)}
            isCompleted={isCompleted}
            toggleMeal={toggleMeal}
            toggling={toggling}
            loading={loading}
            onBack={() => setSelectedDate(null)}
          />
        ) : (
          <SettimanaView
            weekDates={weekDates}
            today={today}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            isCompleted={isCompleted}
            onSelectDay={setSelectedDate}
          />
        )
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

// ---- DayView (detail for any selected day) ----

function DayView({
  date, dateStr, dayPlan, isCompleted, toggleMeal, toggling, loading, onBack,
}: {
  date: Date;
  dateStr: string;
  dayPlan: DayPlan;
  isCompleted: (date: string, meal: string) => boolean;
  toggleMeal: (date: string, meal: string) => void;
  toggling: string | null;
  loading: boolean;
  onBack: () => void;
}) {
  const dayLabel = date.toLocaleDateString("it-IT", { weekday: "long" });
  const dateLabel = date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const done = MEAL_ORDER.filter(m => isCompleted(dateStr, m)).length;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium active:scale-95 transition-all"
        style={{ color: "var(--theme-text-muted)" }}
      >
        ‹ Torna alla settimana
      </button>

      <div className="rounded-2xl border p-4 space-y-2" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <p className="font-bold text-white capitalize">{dayLabel}, {dateLabel}</p>
        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
          {done} / 4 pasti completati
        </p>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--theme-bg)" }}>
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${(done / 4) * 100}%` }}
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
            dateStr={dateStr}
            done={isCompleted(dateStr, meal.time)}
            onToggle={toggleMeal}
            isToggling={toggling === `${dateStr}:${meal.time}`}
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
          <span className="text-2xl">{MEAL_ICONS[meal.time as MealTime]}</span>
          <div>
            <p className={cn("font-semibold text-sm", done ? "text-green-400" : "text-white")}>
              {meal.label}
            </p>
            <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
              {MEAL_REMINDERS[meal.time as MealTime]}
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
  weekDates, today, weekOffset, setWeekOffset, isCompleted, onSelectDay,
}: {
  weekDates: Date[];
  today: Date;
  weekOffset: number;
  setWeekOffset: (n: number) => void;
  isCompleted: (date: string, meal: string) => boolean;
  onSelectDay: (d: Date) => void;
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
          <button
            key={ds}
            onClick={() => onSelectDay(d)}
            className={cn("w-full text-left rounded-2xl border p-3 flex items-center gap-3 transition-all active:scale-[0.98]", isToday && "border-amber-500/40")}
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
            <span className="shrink-0 text-gray-600 text-lg leading-none">›</span>
          </button>
        );
      })}
    </div>
  );
}

// ---- Note ----

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function NoteView() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/nutrizionista/docs")
      .then(r => r.json())
      .then(data => setDocs(data.docs || []));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File troppo grande (max 5MB)");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      try {
        const res = await fetch("/api/nutrizionista/docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: file.name,
            mimeType: file.type || "application/octet-stream",
            data: base64,
            size: file.size,
          }),
        });
        const doc = await res.json();
        if (doc.id) setDocs(prev => [doc, ...prev]);
        else setUploadError(doc.error ?? "Errore durante il caricamento");
      } catch {
        setUploadError("Errore durante il caricamento");
      }
      setUploading(false);
    };
    reader.onerror = () => { setUploadError("Errore di lettura file"); setUploading(false); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const deleteDoc = async (id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id));
    await fetch(`/api/nutrizionista/docs/${id}`, { method: "DELETE" });
  };

  const docIcon = (mimeType: string) => {
    if (mimeType === "application/pdf") return "📑";
    if (mimeType.startsWith("image/")) return "🖼️";
    return "📄";
  };

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

      {/* Documenti */}
      <div className="rounded-2xl border p-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-amber-400">📄 Documenti</p>
          <label className={cn(
            "cursor-pointer text-xs px-3 py-1.5 rounded-lg font-medium transition-all",
            uploading ? "opacity-50 cursor-not-allowed" : "bg-amber-500/20 text-amber-400 active:scale-95"
          )}>
            {uploading ? "Caricamento…" : "+ Carica"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {uploadError && (
          <p className="text-xs text-red-400 mb-2">{uploadError}</p>
        )}

        {docs.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nessun documento. Carica la scheda della nutrizionista (PDF, immagine — max 5MB).
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--theme-bg)" }}>
                <span className="text-xl shrink-0">{docIcon(doc.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <a
                    href={`/api/nutrizionista/docs/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white font-medium truncate block hover:text-amber-400 transition-colors"
                  >
                    {doc.title}
                  </a>
                  <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                    {formatSize(doc.size)}
                  </p>
                </div>
                <button
                  onClick={() => deleteDoc(doc.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors p-1 text-lg leading-none shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
