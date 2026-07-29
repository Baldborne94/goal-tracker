"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { dayKey } from "@/lib/utils";

type Exercise = {
  id: string; name: string; muscleGroup: string;
  sets: number; repsMin: number | null; repsMax: number | null;
  repsNote: string | null; restSec: number | null; weightNote: string | null; order: number;
};
type GymDay = {
  id: string; name: string; emoji: string; order: number;
  exercises: Exercise[]; lastLogDate: string | null;
};
type SetData = { weight: string; reps: string; done: boolean };
type SessionEntries = Record<string, SetData[]>;
type LogEntry = {
  exerciseId: string; exerciseName: string | null;
  setNumber: number; reps: number | null; weight: number | null;
};
type GymLog = {
  id: string; date: string; durationMin: number | null;
  notes: string | null; entries: LogEntry[];
};

function repsLabel(ex: Exercise): string {
  if (!ex.repsMin && ex.repsNote) return ex.repsNote;
  if (ex.repsMin && ex.repsMax && ex.repsMin !== ex.repsMax) return `${ex.repsMin}-${ex.repsMax}`;
  if (ex.repsMin) return `${ex.repsMin}`;
  return ex.repsNote ?? "";
}

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// ─── Allena Tab ────────────────────────────────────────────────────────────────

function AllenaView({ days, selectedDay, entries, timerSec, saving, saved, onSelect, onUpdateSet, onToggle, onSave, onBack }: {
  days: GymDay[];
  selectedDay: GymDay | null;
  entries: SessionEntries;
  timerSec: number | null;
  saving: boolean;
  saved: boolean;
  onSelect: (d: GymDay) => void;
  onUpdateSet: (exId: string, i: number, field: "weight" | "reps", val: string) => void;
  onToggle: (exId: string, i: number, restSec: number | null) => void;
  onSave: () => void;
  onBack: () => void;
}) {
  if (!selectedDay) {
    return (
      <div className="space-y-3 pt-2">
        {saved && (
          <div className="rounded-2xl p-3 text-center text-sm font-semibold text-green-400 border" style={{ background: "rgba(22,163,74,0.1)", borderColor: "rgba(22,163,74,0.3)" }}>
            ✓ Sessione salvata! Ottimo lavoro 💪
          </div>
        )}
        {days.map(day => {
          const mainExercises = day.exercises.filter(e => e.muscleGroup !== "Riscaldamento");
          return (
            <button
              key={day.id}
              onClick={() => onSelect(day)}
              className="w-full text-left rounded-2xl border p-4 active:scale-95 transition-transform"
              style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{day.emoji}</span>
                  <div>
                    <p className="font-semibold text-[#ede9ff]">{day.name}</p>
                    <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                      {mainExercises.length} esercizi
                      {day.lastLogDate ? ` · Ultimo: ${fmtDate(day.lastLogDate)}` : " · Mai allenato"}
                    </p>
                  </div>
                </div>
                <span className="text-amber-400 font-bold text-lg">›</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const exercisesByGroup = selectedDay.exercises.reduce<Record<string, Exercise[]>>((acc, ex) => {
    acc[ex.muscleGroup] = [...(acc[ex.muscleGroup] ?? []), ex];
    return acc;
  }, {});

  const allSets = Object.values(entries).flat();
  const doneSets = allSets.filter(s => s.done).length;

  return (
    <div className="pt-2">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-sm" style={{ color: "var(--theme-text-muted)" }}>← Torna</button>
        <span className="font-bold text-[#ede9ff]">{selectedDay.emoji} {selectedDay.name}</span>
        {timerSec !== null && (
          <span className="ml-auto px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400">
            ⏱ {timerSec}s
          </span>
        )}
      </div>

      <div className="space-y-4 mb-6">
        {Object.entries(exercisesByGroup).map(([group, exList]) => (
          <div key={group}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--theme-text-muted)" }}>
              {group}
            </p>
            <div className="space-y-3">
              {exList.map(ex => {
                const exSets = entries[ex.id];
                if (!exSets) return (
                  <div key={ex.id} className="rounded-2xl border p-3" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
                    <p className="text-sm text-[#ede9ff]">{ex.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--theme-text-muted)" }}>
                      {ex.sets} × {repsLabel(ex)} {ex.weightNote ? `· ${ex.weightNote}` : ""}
                    </p>
                  </div>
                );
                const doneSetsEx = exSets.filter(s => s.done).length;
                return (
                  <div key={ex.id} className="rounded-2xl border p-3" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-[#ede9ff]">{ex.name}</p>
                        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                          {ex.sets} × {repsLabel(ex)} {ex.weightNote ? `· ${ex.weightNote}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-amber-400">{doneSetsEx}/{ex.sets}</span>
                    </div>
                    <div className="space-y-1.5">
                      {exSets.map((set, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded-xl p-2 transition-colors ${set.done ? "opacity-60" : ""}`}
                          style={{ background: "var(--theme-bg)" }}>
                          <span className="text-xs w-8 text-center font-mono" style={{ color: "var(--theme-text-muted)" }}>S{i + 1}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="kg"
                            value={set.weight}
                            onChange={e => onUpdateSet(ex.id, i, "weight", e.target.value)}
                            disabled={set.done}
                            className="w-16 bg-transparent border rounded-lg px-2 py-1 text-sm text-center text-[#ede9ff] focus:outline-none"
                            style={{ borderColor: "var(--theme-surface-border)" }}
                          />
                          <span className="text-xs" style={{ color: "var(--theme-text-muted)" }}>×</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="rep"
                            value={set.reps}
                            onChange={e => onUpdateSet(ex.id, i, "reps", e.target.value)}
                            disabled={set.done}
                            className="w-16 bg-transparent border rounded-lg px-2 py-1 text-sm text-center text-[#ede9ff] focus:outline-none"
                            style={{ borderColor: "var(--theme-surface-border)" }}
                          />
                          <button
                            onClick={() => onToggle(ex.id, i, ex.restSec)}
                            className={`ml-auto w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${set.done ? "bg-amber-500 border-amber-500 text-black" : "border-[#3b2d6e] text-transparent"}`}
                          >
                            ✓
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onSave}
        disabled={saving || doneSets === 0}
        className="w-full py-3 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-40"
        style={{ background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }}
      >
        {saving ? "Salvataggio..." : `💾 Salva sessione (${doneSets} serie)`}
      </button>
    </div>
  );
}

// ─── Programma Tab ─────────────────────────────────────────────────────────────

const EMPTY_ADD_FORM = { name: "", muscleGroup: "", sets: 3, repsMin: null as number | null, repsMax: null as number | null, repsNote: null as string | null, restSec: 60 as number | null, weightNote: null as string | null };

function ExerciseForm({
  form, onChange, onSave, onCancel, saving, submitLabel,
}: {
  form: typeof EMPTY_ADD_FORM;
  onChange: (f: typeof EMPTY_ADD_FORM) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="rounded-xl p-3 space-y-2 mt-2" style={{ background: "var(--theme-bg)" }}>
      <input
        value={form.name}
        onChange={e => onChange({ ...form, name: e.target.value })}
        placeholder="Nome esercizio *"
        className="w-full bg-transparent border rounded-lg px-3 py-1.5 text-sm text-[#ede9ff] focus:outline-none"
        style={{ borderColor: "var(--theme-surface-border)" }}
      />
      <input
        value={form.muscleGroup}
        onChange={e => onChange({ ...form, muscleGroup: e.target.value })}
        placeholder="Gruppo muscolare (es. Petto, Schiena…) *"
        className="w-full bg-transparent border rounded-lg px-3 py-1.5 text-sm text-[#ede9ff] focus:outline-none"
        style={{ borderColor: "var(--theme-surface-border)" }}
      />
      <div className="flex gap-2">
        {([
          { label: "Serie", key: "sets" as const },
          { label: "Rep min", key: "repsMin" as const },
          { label: "Rep max", key: "repsMax" as const },
          { label: "Riposo s", key: "restSec" as const },
        ] as const).map(({ label, key }) => (
          <div key={key} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium" style={{ color: "var(--theme-text-muted)" }}>{label}</span>
            <input
              type="number"
              inputMode="numeric"
              value={form[key] ?? ""}
              onChange={e => onChange({ ...form, [key]: e.target.value ? parseInt(e.target.value) : null })}
              className="w-full bg-transparent border rounded-lg px-1 py-1.5 text-sm text-center text-[#ede9ff] focus:outline-none"
              style={{ borderColor: "var(--theme-surface-border)" }}
            />
          </div>
        ))}
      </div>
      <input
        value={form.weightNote ?? ""}
        onChange={e => onChange({ ...form, weightNote: e.target.value || null })}
        placeholder="Note peso (es. ~60-80 kg)"
        className="w-full bg-transparent border rounded-lg px-3 py-1.5 text-sm text-[#ede9ff] focus:outline-none"
        style={{ borderColor: "var(--theme-surface-border)" }}
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim() || !form.muscleGroup.trim()}
          className="flex-1 py-1.5 rounded-xl text-xs font-bold text-black disabled:opacity-40"
          style={{ background: "linear-gradient(to right, #f59e0b, #eab308)" }}
        >
          {saving ? "..." : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded-xl text-xs border"
          style={{ color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function ProgrammaView({ days, onDaysChange }: { days: GymDay[]; onDaysChange: (days: GymDay[]) => void }) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingExId, setEditingExId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<typeof EMPTY_ADD_FORM>({ ...EMPTY_ADD_FORM });
  const [addingDayId, setAddingDayId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<typeof EMPTY_ADD_FORM>({ ...EMPTY_ADD_FORM });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit(ex: Exercise) {
    setAddingDayId(null);
    setConfirmDeleteId(null);
    setEditingExId(ex.id);
    setEditForm({
      name: ex.name, muscleGroup: ex.muscleGroup, sets: ex.sets,
      repsMin: ex.repsMin, repsMax: ex.repsMax, repsNote: ex.repsNote,
      restSec: ex.restSec, weightNote: ex.weightNote,
    });
  }

  async function saveEdit() {
    if (!editingExId) return;
    setSaving(true);
    await fetch(`/api/palestra/exercises/${editingExId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    onDaysChange(days.map(d => ({
      ...d,
      exercises: d.exercises.map(e => e.id === editingExId ? { ...e, ...editForm } as Exercise : e),
    })));
    setEditingExId(null);
    setSaving(false);
  }

  function startAdd(dayId: string) {
    setEditingExId(null);
    setConfirmDeleteId(null);
    setAddingDayId(dayId);
    setAddForm({ ...EMPTY_ADD_FORM });
  }

  async function saveAdd(dayId: string) {
    setSaving(true);
    const res = await fetch("/api/palestra/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayId, ...addForm }),
    });
    if (res.ok) {
      const newEx = await res.json() as Exercise;
      onDaysChange(days.map(d =>
        d.id === dayId ? { ...d, exercises: [...d.exercises, newEx] } : d
      ));
      setAddingDayId(null);
    }
    setSaving(false);
  }

  async function deleteExercise(exId: string, dayId: string) {
    await fetch(`/api/palestra/exercises/${exId}`, { method: "DELETE" });
    onDaysChange(days.map(d =>
      d.id === dayId ? { ...d, exercises: d.exercises.filter(e => e.id !== exId) } : d
    ));
    setConfirmDeleteId(null);
  }

  return (
    <div className="space-y-3 pt-2">
      {days.map(day => {
        const isExpanded = expandedDay === day.id;
        return (
          <div key={day.id} className="rounded-2xl border overflow-hidden" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <button
              onClick={() => { setExpandedDay(isExpanded ? null : day.id); setEditingExId(null); setAddingDayId(null); setConfirmDeleteId(null); }}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <span className="text-2xl">{day.emoji}</span>
              <span className="font-semibold text-[#ede9ff] flex-1">{day.name}</span>
              <span className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{day.exercises.length} esercizi</span>
              <span className="ml-2 text-amber-400">{isExpanded ? "▲" : "▼"}</span>
            </button>

            {isExpanded && (
              <div className="border-t px-4 pb-4 space-y-1" style={{ borderColor: "var(--theme-surface-border)" }}>
                {day.exercises.map(ex => (
                  <div key={ex.id}>
                    {editingExId === ex.id ? (
                      <ExerciseForm
                        form={editForm}
                        onChange={setEditForm}
                        onSave={saveEdit}
                        onCancel={() => setEditingExId(null)}
                        saving={saving}
                        submitLabel="Salva"
                      />
                    ) : (
                      <div className="flex items-center gap-1 py-1.5 rounded-xl px-1">
                        <button
                          onClick={() => startEdit(ex)}
                          className="flex-1 text-left active:bg-white/5 rounded-lg px-1"
                        >
                          <p className="text-sm text-[#ede9ff]">{ex.name}</p>
                          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                            {ex.sets} serie × {repsLabel(ex)} rep
                            {ex.weightNote ? ` · ${ex.weightNote}` : ""}
                            {ex.restSec ? ` · ${ex.restSec}s riposo` : ""}
                          </p>
                        </button>
                        <button
                          onClick={() => startEdit(ex)}
                          className="p-1.5 text-sm"
                          style={{ color: "var(--theme-text-muted)" }}
                        >✏️</button>
                        {confirmDeleteId === ex.id ? (
                          <>
                            <button
                              onClick={() => deleteExercise(ex.id, day.id)}
                              className="text-xs px-2 py-1 rounded-lg font-semibold text-white"
                              style={{ background: "rgba(239,68,68,0.8)" }}
                            >Elimina</button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs px-2 py-1 rounded-lg border"
                              style={{ color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }}
                            >No</button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditingExId(null); setConfirmDeleteId(ex.id); }}
                            className="p-1.5 text-sm"
                            style={{ color: "var(--theme-text-muted)" }}
                          >🗑</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add exercise */}
                {addingDayId === day.id ? (
                  <ExerciseForm
                    form={addForm}
                    onChange={setAddForm}
                    onSave={() => saveAdd(day.id)}
                    onCancel={() => setAddingDayId(null)}
                    saving={saving}
                    submitLabel="Aggiungi"
                  />
                ) : (
                  <button
                    onClick={() => startAdd(day.id)}
                    className="w-full mt-2 py-2 rounded-xl text-xs font-semibold border-dashed border transition-all active:scale-95"
                    style={{ color: "var(--theme-accent)", borderColor: "var(--theme-accent)", background: "transparent" }}
                  >
                    + Aggiungi esercizio
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Storico Tab ───────────────────────────────────────────────────────────────

function StoricoView({ days, historyDayId, logs, loading, onSelectDay, onDeleteLog }: {
  days: GymDay[];
  historyDayId: string | null;
  logs: GymLog[];
  loading: boolean;
  onSelectDay: (id: string) => void;
  onDeleteLog: (id: string) => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/palestra/logs/${id}`, { method: "DELETE" });
    onDeleteLog(id);
    setDeletingId(null);
    setConfirmId(null);
  }

  return (
    <div className="pt-2">
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {days.map(d => (
          <button
            key={d.id}
            onClick={() => onSelectDay(d.id)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
            style={historyDayId === d.id
              ? { background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }
              : { background: "var(--theme-surface)", color: "var(--theme-text-muted)", border: "1px solid var(--theme-surface-border)" }
            }
          >
            {d.emoji} {d.name}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-sm py-4" style={{ color: "var(--theme-text-muted)" }}>Carico...</p>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>Nessuna sessione registrata</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const grouped = log.entries.reduce<Record<string, { name: string | null; sets: { w: number | null; r: number | null }[] }>>((acc, e) => {
              if (!acc[e.exerciseId]) acc[e.exerciseId] = { name: e.exerciseName, sets: [] };
              acc[e.exerciseId].sets.push({ w: e.weight, r: e.reps });
              return acc;
            }, {});
            return (
              <div key={log.id} className="rounded-2xl border p-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-[#ede9ff]">📅 {fmtDate(log.date)}</p>
                  <div className="flex items-center gap-2">
                    {log.durationMin && (
                      <span className="text-xs text-amber-400">⏱ {log.durationMin} min</span>
                    )}
                    {confirmId === log.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deletingId === log.id}
                          className="text-xs px-2 py-1 rounded-lg font-semibold text-white"
                          style={{ background: "rgba(239,68,68,0.8)" }}
                        >
                          {deletingId === log.id ? "..." : "Elimina"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs px-2 py-1 rounded-lg border"
                          style={{ color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }}
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmId(log.id)}
                        className="text-xs px-2 py-1 rounded-lg border"
                        style={{ color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
                {Object.values(grouped).length > 0 ? (
                  <div className="space-y-1">
                    {Object.values(grouped).map((ex, idx) => (
                      <div key={idx} className="text-sm">
                        <span className="text-[#c4b5fd]">{ex.name ?? "Esercizio"}</span>
                        <span className="text-xs ml-2" style={{ color: "var(--theme-text-muted)" }}>
                          {ex.sets.map(s => `${s.w ?? "?"}kg×${s.r ?? "?"}`).join(" · ")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Sessione completata senza dettagli</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PalestraClient() {
  const [tab, setTab] = useState<"allena" | "programma" | "storico">("allena");
  const [days, setDays] = useState<GymDay[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [sessionEntries, setSessionEntries] = useState<SessionEntries>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedDayId, setSavedDayId] = useState<string | null>(null);
  const [timerSec, setTimerSec] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [historyDayId, setHistoryDayId] = useState<string | null>(null);
  const [logs, setLogs] = useState<GymLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsVersion, setLogsVersion] = useState(0);

  useEffect(() => {
    fetch("/api/palestra/days")
      .then(r => r.json())
      .then(data => { setDays(data.days ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "storico" && !historyDayId && days.length > 0) {
      setHistoryDayId(days[0].id);
    }
  }, [tab, days, historyDayId]);

  useEffect(() => {
    if (tab !== "storico" || !historyDayId) return;
    setLogsLoading(true);
    fetch(`/api/palestra/logs?dayId=${historyDayId}&limit=10`)
      .then(r => r.json())
      .then(data => { setLogs(data.logs ?? []); setLogsLoading(false); })
      .catch(() => setLogsLoading(false));
  }, [tab, historyDayId, logsVersion]);

  function selectDay(day: GymDay) {
    const entries: SessionEntries = {};
    for (const ex of day.exercises) {
      if (ex.muscleGroup === "Riscaldamento") continue;
      entries[ex.id] = Array.from({ length: ex.sets }, () => ({ weight: "", reps: "", done: false }));
    }
    setSessionEntries(entries);
    setSelectedDayId(day.id);
    setSaved(false);
  }

  function updateSet(exId: string, i: number, field: "weight" | "reps", val: string) {
    setSessionEntries(prev => ({
      ...prev,
      [exId]: prev[exId].map((s, idx) => idx === i ? { ...s, [field]: val } : s),
    }));
  }

  function toggleSetDone(exId: string, i: number, restSec: number | null) {
    setSessionEntries(prev => {
      const newDone = !prev[exId][i].done;
      if (newDone && restSec && restSec > 0) startTimer(restSec);
      return {
        ...prev,
        [exId]: prev[exId].map((s, idx) => idx === i ? { ...s, done: newDone } : s),
      };
    });
  }

  function startTimer(sec: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerSec(sec);
    timerRef.current = setInterval(() => {
      setTimerSec(prev => {
        if (!prev || prev <= 1) { clearInterval(timerRef.current!); return null; }
        return prev - 1;
      });
    }, 1000);
  }

  async function saveSession() {
    const day = days.find(d => d.id === selectedDayId);
    if (!day) return;
    setSaving(true);

    const today = dayKey();
    const entries: { exerciseId: string; setNumber: number; weight?: number; reps?: number }[] = [];

    for (const [exId, sets] of Object.entries(sessionEntries)) {
      sets.forEach((set, idx) => {
        if (set.done || set.weight || set.reps) {
          entries.push({
            exerciseId: exId,
            setNumber: idx + 1,
            ...(set.weight ? { weight: parseFloat(set.weight) } : {}),
            ...(set.reps ? { reps: parseInt(set.reps) } : {}),
          });
        }
      });
    }

    const r = await fetch("/api/palestra/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayId: selectedDayId, date: today, entries }),
    });

    if (r.ok) {
      setSaved(true);
      setSavedDayId(selectedDayId);
      setDays(prev => prev.map(d => d.id === selectedDayId ? { ...d, lastLogDate: today } : d));
      setSelectedDayId(null);
      setSessionEntries({});
      setLogsVersion(v => v + 1);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--theme-text-muted)" }}>
        Carico programma...
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link
          href="/vita"
          className="w-8 h-8 flex items-center justify-center rounded-full border text-sm"
          style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}
        >
          ←
        </Link>
        <h1 className="text-xl font-bold text-amber-400">🏋️ Programma Palestra</h1>
      </div>

      <div className="flex gap-1 px-4 pt-2 pb-1">
        {(["allena", "programma", "storico"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
            style={tab === t
              ? { background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }
              : { background: "var(--theme-surface)", color: "var(--theme-text-muted)", border: "1px solid var(--theme-surface-border)" }
            }
          >
            {t === "allena" ? "💪 Allena" : t === "programma" ? "📋 Programma" : "📊 Storico"}
          </button>
        ))}
      </div>

      <div className="px-4">
        {tab === "allena" && (
          <AllenaView
            days={days}
            selectedDay={days.find(d => d.id === selectedDayId) ?? null}
            entries={sessionEntries}
            timerSec={timerSec}
            saving={saving}
            saved={saved}
            onSelect={selectDay}
            onUpdateSet={updateSet}
            onToggle={toggleSetDone}
            onSave={saveSession}
            onBack={() => { setSelectedDayId(null); setSaved(false); }}
          />
        )}
        {tab === "programma" && (
          <ProgrammaView days={days} onDaysChange={setDays} />
        )}
        {tab === "storico" && (
          <StoricoView
            days={days}
            historyDayId={savedDayId ?? historyDayId}
            logs={logs}
            loading={logsLoading}
            onSelectDay={id => { setHistoryDayId(id); setSavedDayId(null); setLogs([]); }}
            onDeleteLog={id => setLogs(prev => prev.filter(l => l.id !== id))}
          />
        )}
      </div>
    </div>
  );
}
