"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

type WorkoutExercise = {
  id: string;
  name: string;
  category: string;
  exerciseType: "strength" | "cardio";
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  durationMin: number | null;
  met: number | null;
  kcalBurned: number;
};

type HistoryDay = {
  date: string;
  exerciseCount: number;
  kcalBurned: number;
};

type ExercisePreset = {
  name: string;
  category: string;
  exerciseType: "strength" | "cardio";
  met: number;
  icon: string;
};

const PRESETS: ExercisePreset[] = [
  { name: "Squat", category: "Forza", exerciseType: "strength", met: 5.0, icon: "🏋️" },
  { name: "Deadlift", category: "Forza", exerciseType: "strength", met: 6.0, icon: "🏋️" },
  { name: "Bench Press", category: "Forza", exerciseType: "strength", met: 5.0, icon: "💪" },
  { name: "Overhead Press", category: "Forza", exerciseType: "strength", met: 4.0, icon: "🙌" },
  { name: "Pull-up", category: "Forza", exerciseType: "strength", met: 5.0, icon: "⬆️" },
  { name: "Dip", category: "Forza", exerciseType: "strength", met: 4.5, icon: "⬇️" },
  { name: "Barbell Row", category: "Forza", exerciseType: "strength", met: 4.0, icon: "🔄" },
  { name: "Leg Press", category: "Forza", exerciseType: "strength", met: 4.0, icon: "🦵" },
  { name: "Lunges", category: "Forza", exerciseType: "strength", met: 4.5, icon: "🦵" },
  { name: "Bicep Curl", category: "Forza", exerciseType: "strength", met: 3.5, icon: "💪" },
  { name: "Tricep Extension", category: "Forza", exerciseType: "strength", met: 3.5, icon: "💪" },
  { name: "Push-up", category: "Forza", exerciseType: "strength", met: 4.0, icon: "🔼" },
  { name: "Plank", category: "Core", exerciseType: "strength", met: 3.0, icon: "🧘" },
  { name: "Crunch", category: "Core", exerciseType: "strength", met: 3.0, icon: "🔄" },
  { name: "Leg Raise", category: "Core", exerciseType: "strength", met: 3.0, icon: "🦵" },
  { name: "Corsa 8 km/h", category: "Cardio", exerciseType: "cardio", met: 8.0, icon: "🏃" },
  { name: "Corsa 10 km/h", category: "Cardio", exerciseType: "cardio", met: 10.0, icon: "🏃" },
  { name: "Corsa 12 km/h", category: "Cardio", exerciseType: "cardio", met: 12.5, icon: "🏃" },
  { name: "Camminata", category: "Cardio", exerciseType: "cardio", met: 3.5, icon: "🚶" },
  { name: "Ciclismo — moderato", category: "Cardio", exerciseType: "cardio", met: 7.0, icon: "🚴" },
  { name: "Ciclismo — intenso", category: "Cardio", exerciseType: "cardio", met: 12.0, icon: "🚴" },
  { name: "Nuoto", category: "Cardio", exerciseType: "cardio", met: 8.0, icon: "🏊" },
  { name: "HIIT", category: "Cardio", exerciseType: "cardio", met: 8.5, icon: "⚡" },
  { name: "Jump rope", category: "Cardio", exerciseType: "cardio", met: 12.0, icon: "🪢" },
  { name: "Ellittica", category: "Cardio", exerciseType: "cardio", met: 5.0, icon: "🔄" },
  { name: "Vogatore", category: "Cardio", exerciseType: "cardio", met: 7.0, icon: "🚣" },
  { name: "Scalata scale", category: "Cardio", exerciseType: "cardio", met: 8.0, icon: "🪜" },
];

type Props = { initialDate: string };

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string) {
  const today = toDateKey(new Date());
  const yest = toDateKey(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Oggi";
  if (dateStr === yest) return "Ieri";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

function fmtShortDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

export default function WorkoutClient({ initialDate }: Props) {
  const [date, setDate] = useState(initialDate);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [kcalBurned, setKcalBurned] = useState(0);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [userWeightKg, setUserWeightKg] = useState(70);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<"strength" | "cardio">("strength");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ExercisePreset | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weightKg, setWeightKg] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [saving, setSaving] = useState(false);

  const fetchDay = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workout?date=${d}`);
      if (res.ok) {
        const data = await res.json() as { exercises: WorkoutExercise[]; kcalBurned: number };
        setExercises(data.exercises);
        setKcalBurned(data.kcalBurned);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDay(initialDate);
    fetch("/api/workout?history=true")
      .then(r => r.ok ? r.json() : [])
      .then((h: HistoryDay[]) => setHistory(h))
      .catch(() => {});
    fetch("/api/peso")
      .then(r => r.ok ? r.json() : [])
      .then((entries: { weight: number; date: string }[]) => {
        if (entries.length > 0) {
          const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
          setUserWeightKg(sorted[0].weight);
        }
      })
      .catch(() => {});
  }, [initialDate, fetchDay]);

  async function changeDate(delta: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    const newDate = toDateKey(d);
    if (newDate > toDateKey(new Date())) return;
    setDate(newDate);
    await fetchDay(newDate);
  }

  const isToday = date === toDateKey(new Date());

  // Last 14 days for dot grid
  const dotGrid = useMemo(() => {
    const historySet = new Set(history.map(h => h.date));
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000);
      const ds = toDateKey(d);
      return {
        date: ds,
        label: d.toLocaleDateString("it-IT", { weekday: "short" }).slice(0, 3),
        isToday: ds === toDateKey(new Date()),
        done: historySet.has(ds),
        isCurrent: ds === date,
      };
    });
  }, [history, date]);

  const filteredPresets = useMemo(() => {
    const q = search.toLowerCase().trim();
    const typed = tab === "strength" ? ["strength"] : ["cardio"];
    return PRESETS.filter(p => p.exerciseType === typed[0] && (!q || p.name.toLowerCase().includes(q)));
  }, [search, tab]);

  const estimatedKcal = useMemo(() => {
    if (!selected && !customMode) return null;
    const met = selected?.met ?? 4.0;
    if (tab === "cardio") {
      const dur = parseFloat(durationMin);
      if (!dur || dur <= 0) return null;
      return Math.round(met * userWeightKg * (dur / 60));
    } else {
      const s = parseInt(sets);
      if (!s || s <= 0) return null;
      return Math.round(met * userWeightKg * (s * 2.5 / 60));
    }
  }, [selected, customMode, tab, durationMin, sets, userWeightKg]);

  function openModal() {
    setShowModal(true);
    setTab("strength");
    setSearch("");
    setSelected(null);
    setCustomMode(false);
    setCustomName("");
    setSets("3");
    setReps("10");
    setWeightKg("");
    setDurationMin("30");
  }

  async function addExercise() {
    const name = customMode ? customName.trim() : selected?.name ?? "";
    if (!name) return;

    setSaving(true);
    const body: Record<string, unknown> = {
      date,
      name,
      exerciseType: tab,
      category: customMode ? (tab === "cardio" ? "Cardio" : "Forza") : (selected?.category ?? "Forza"),
      met: customMode ? (tab === "cardio" ? 7.0 : 4.0) : (selected?.met ?? 4.0),
      userWeightKg,
    };

    if (tab === "strength") {
      body.sets = parseInt(sets) || null;
      body.reps = parseInt(reps) || null;
      body.weightKg = parseFloat(weightKg) || null;
    } else {
      body.durationMin = parseInt(durationMin) || null;
    }

    const res = await fetch("/api/workout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const exercise = await res.json() as WorkoutExercise;
      setExercises(prev => [...prev, exercise]);
      setKcalBurned(prev => prev + exercise.kcalBurned);
      // Update history dot
      setHistory(prev => {
        const exists = prev.find(h => h.date === date);
        if (exists) {
          return prev.map(h => h.date === date ? { ...h, exerciseCount: h.exerciseCount + 1, kcalBurned: h.kcalBurned + exercise.kcalBurned } : h);
        }
        return [{ date, exerciseCount: 1, kcalBurned: exercise.kcalBurned }, ...prev];
      });
      // Reset for next exercise (keep modal open to add more)
      setSelected(null);
      setCustomMode(false);
      setCustomName("");
      setSets("3");
      setReps("10");
      setWeightKg("");
      setDurationMin("30");
    }
    setSaving(false);
  }

  async function deleteExercise(id: string, kcal: number) {
    const res = await fetch(`/api/workout/exercise/${id}`, { method: "DELETE" });
    if (res.ok) {
      setExercises(prev => prev.filter(e => e.id !== id));
      setKcalBurned(prev => Math.max(0, prev - kcal));
    }
  }

  function exerciseLabel(e: WorkoutExercise) {
    if (e.exerciseType === "cardio") return `${e.durationMin} min`;
    const parts = [];
    if (e.sets) parts.push(`${e.sets} serie`);
    if (e.reps) parts.push(`${e.reps} reps`);
    if (e.weightKg) parts.push(`${e.weightKg} kg`);
    return parts.join(" · ") || "—";
  }

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/vita" className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold flex-shrink-0" style={{ background: "var(--theme-surface)", color: "var(--theme-text-muted)" }}>‹</Link>
        <div>
          <h1 className="text-xl font-bold text-amber-400">🏋️ Allenamento</h1>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
            {userWeightKg !== 70 ? `Peso: ${userWeightKg} kg` : "Aggiungi il tuo peso per kcal precise"}
          </p>
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between rounded-2xl border px-4 py-3" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <button onClick={() => changeDate(-1)} disabled={loading} className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold disabled:opacity-40" style={{ color: "var(--theme-text-muted)" }}>‹</button>
        <div className="text-center">
          <p className="font-semibold text-[#ede9ff] text-sm">{formatDateLabel(date)}</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
            {new Date(date + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday || loading} className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold disabled:opacity-30" style={{ color: "var(--theme-text-muted)" }}>›</button>
      </div>

      {/* Today's workout card */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ background: "var(--theme-surface)", borderColor: kcalBurned > 0 ? "var(--theme-accent)" : "var(--theme-surface-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#ede9ff]">
              {exercises.length === 0 ? "Nessun esercizio" : `${exercises.length} esercizi`}
            </p>
            {kcalBurned > 0 && (
              <p className="text-xs font-bold text-amber-400">🔥 {kcalBurned} kcal bruciate</p>
            )}
          </div>
          <button
            onClick={openModal}
            className="px-4 py-2 rounded-xl text-sm font-bold text-black active:scale-95 transition-all"
            style={{ background: "var(--theme-accent)" }}
          >
            + Aggiungi
          </button>
        </div>

        {exercises.length === 0 && (
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
            Nessun esercizio registrato. Tocca &ldquo;+ Aggiungi&rdquo; per iniziare.
          </p>
        )}

        {exercises.map(e => (
          <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "var(--theme-bg)" }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#ede9ff] truncate">{e.name}</p>
              <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>
                {e.category} · {exerciseLabel(e)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {e.kcalBurned > 0 && (
                <span className="text-xs font-bold text-amber-400">{e.kcalBurned} kcal</span>
              )}
              <button onClick={() => deleteExercise(e.id, e.kcalBurned)} className="text-sm leading-none hover:text-red-400 transition-colors" style={{ color: "var(--theme-surface-border)" }}>×</button>
            </div>
          </div>
        ))}
      </div>

      {/* 14-day dot grid */}
      <div className="rounded-2xl border p-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--theme-text-muted)" }}>Ultimi 14 giorni</p>
        <div className="grid grid-cols-7 gap-1.5">
          {dotGrid.map(d => (
            <button
              key={d.date}
              onClick={() => { setDate(d.date); fetchDay(d.date); }}
              className="flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all"
              style={{
                background: d.isCurrent ? "rgba(245,158,11,0.15)" : "transparent",
                border: d.isCurrent ? "1px solid rgba(245,158,11,0.5)" : "1px solid transparent",
              }}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  background: d.done
                    ? (d.isToday ? "#f59e0b" : "#7c5fcc")
                    : "rgba(59,45,110,0.4)",
                }}
              />
              <span className="text-[9px]" style={{ color: d.isCurrent ? "#f59e0b" : "var(--theme-text-muted)" }}>
                {d.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* History list */}
      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "var(--theme-text-muted)" }}>Storico</p>
          {history.slice(0, 10).map(h => (
            <button
              key={h.date}
              onClick={() => { setDate(h.date); fetchDay(h.date); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98]"
              style={{ background: "var(--theme-surface)", borderColor: h.date === date ? "var(--theme-accent)" : "var(--theme-surface-border)" }}
            >
              <span className="text-lg">🏋️</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-[#ede9ff]">{fmtShortDate(h.date)}</p>
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                  {h.exerciseCount} esercizi
                </p>
              </div>
              {h.kcalBurned > 0 && (
                <span className="text-xs font-bold text-amber-400">🔥 {h.kcalBurned} kcal</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Add exercise modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[60]" onClick={() => setShowModal(false)}>
          <div
            className="rounded-t-2xl border w-full max-w-lg flex flex-col"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", maxHeight: "88vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <h3 className="font-bold text-[#ede9ff]">Aggiungi esercizio</h3>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl text-lg" style={{ color: "var(--theme-text-muted)" }}>×</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-5 pb-3 flex-shrink-0">
              {(["strength", "cardio"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSelected(null); setSearch(""); }}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: tab === t ? "var(--theme-accent)" : "var(--theme-bg)",
                    color: tab === t ? "#0c0a1a" : "var(--theme-text-muted)",
                  }}
                >
                  {t === "strength" ? "💪 Forza" : "🏃 Cardio"}
                </button>
              ))}
            </div>

            {/* Selected exercise details */}
            {(selected || customMode) && (
              <div className="px-5 pb-3 flex-shrink-0 border-t space-y-3 pt-3" style={{ borderColor: "var(--theme-surface-border)" }}>
                {selected && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "var(--theme-bg)" }}>
                    <div>
                      <p className="text-sm font-semibold text-[#ede9ff]">{selected.icon} {selected.name}</p>
                      <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>MET {selected.met} · {selected.category}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}>cambia</button>
                  </div>
                )}
                {customMode && (
                  <input
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Nome esercizio"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-[#ede9ff] placeholder-[#4a3a7a] focus:outline-none border"
                    style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                  />
                )}

                {tab === "strength" ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] mb-1 block" style={{ color: "var(--theme-text-muted)" }}>Serie</label>
                      <input type="number" value={sets} onChange={e => setSets(e.target.value)} min="1" max="20"
                        className="w-full px-3 py-2 rounded-xl text-sm text-[#ede9ff] border focus:outline-none"
                        style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] mb-1 block" style={{ color: "var(--theme-text-muted)" }}>Ripetizioni</label>
                      <input type="number" value={reps} onChange={e => setReps(e.target.value)} min="1" max="100"
                        className="w-full px-3 py-2 rounded-xl text-sm text-[#ede9ff] border focus:outline-none"
                        style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }} />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] mb-1 block" style={{ color: "var(--theme-text-muted)" }}>Peso (kg)</label>
                      <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="—" step="0.5"
                        className="w-full px-3 py-2 rounded-xl text-sm text-[#ede9ff] border focus:outline-none"
                        style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }} />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 items-center">
                    <div className="flex-1">
                      <label className="text-[10px] mb-1 block" style={{ color: "var(--theme-text-muted)" }}>Durata (minuti)</label>
                      <input type="number" value={durationMin} onChange={e => setDurationMin(e.target.value)} min="1" max="300"
                        className="w-full px-3 py-2 rounded-xl text-sm text-[#ede9ff] border focus:outline-none"
                        style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }} />
                    </div>
                    {estimatedKcal !== null && (
                      <div className="text-center flex-shrink-0 pt-4">
                        <p className="text-lg font-bold text-amber-400">{estimatedKcal}</p>
                        <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>kcal stimate</p>
                      </div>
                    )}
                  </div>
                )}

                {tab === "strength" && estimatedKcal !== null && (
                  <p className="text-xs text-center" style={{ color: "var(--theme-text-muted)" }}>
                    ~{estimatedKcal} kcal stimate
                  </p>
                )}

                <button
                  onClick={addExercise}
                  disabled={saving || (!selected && !customMode) || (customMode && !customName.trim())}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50 active:scale-95 transition-all"
                  style={{ background: "var(--theme-accent)" }}
                >
                  {saving ? "Salvando..." : "Aggiungi esercizio"}
                </button>
              </div>
            )}

            {/* Search + preset list */}
            {!selected && !customMode && (
              <>
                <div className="px-5 pb-2 flex-shrink-0">
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={tab === "strength" ? "Cerca esercizio (es. squat, bench...)" : "Cerca attività (es. corsa, nuoto...)"}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-[#ede9ff] placeholder-[#4a3a7a] focus:outline-none border"
                    style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                  />
                </div>
                <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-1.5">
                  {filteredPresets.map(p => (
                    <button
                      key={p.name}
                      onClick={() => setSelected(p)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors active:scale-[0.98]"
                      style={{ background: "var(--theme-bg)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span>{p.icon}</span>
                        <div>
                          <p className="text-sm text-[#ede9ff]">{p.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>{p.category}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold flex-shrink-0 ml-2" style={{ color: "var(--theme-text-muted)" }}>MET {p.met}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setCustomMode(true)}
                    className="w-full px-3 py-2.5 rounded-xl text-left text-sm border-dashed border"
                    style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                  >
                    ✏️ Esercizio personalizzato
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
