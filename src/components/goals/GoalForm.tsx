"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; color: string };
type ReminderFrequency = "daily" | "weekly" | "monthly" | "custom";
type MilestoneInit = { id: string; title: string; completed: boolean };

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

type Props = {
  categories: Category[];
  initialData?: {
    id?: string;
    title: string;
    description: string;
    priority: string;
    targetDate: string;
    categoryId: string;
    reminderTime?: string;
    reminderFrequency?: string;
    reminderDay?: number | null;
    reminderDays?: string | null;
    isRecurring?: boolean;
    recurrenceType?: string | null;
    dailyCheckIn?: boolean;
    checkInXP?: number;
    checkInDays?: string | null;
    tags: string[];
    milestones: string[] | MilestoneInit[];
  };
};

function calcXP(priority: string, milestonesCount: number, hasDescription: boolean, hasTargetDate: boolean): number {
  const base: Record<string, number> = { low: 15, medium: 30, high: 60 };
  let pts = base[priority] ?? 30;
  if (hasTargetDate) pts += 10;
  pts += Math.min(milestonesCount, 5) * 5;
  if (hasDescription) pts += 5;
  return pts;
}

export default function GoalForm({ categories, initialData }: Props) {
  const router = useRouter();
  const isEditing = !!initialData?.id;

  const [form, setForm] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    priority: initialData?.priority || "medium",
    targetDate: initialData?.targetDate || "",
    categoryId: initialData?.categoryId || "",
    reminderTime: initialData?.reminderTime || "",
  });
  const [reminderFrequency, setReminderFrequency] = useState<ReminderFrequency>(
    (initialData?.reminderFrequency as ReminderFrequency) || "daily"
  );
  const [reminderDay, setReminderDay] = useState<number>(
    initialData?.reminderDay ?? new Date().getDay()
  );
  const [reminderDays, setReminderDays] = useState<number[]>(
    initialData?.reminderDays ? initialData.reminderDays.split(",").map(Number) : [new Date().getDay()]
  );
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState("");

  // Milestones: in edit mode existingMilestones holds the current DB milestones;
  // milestones holds newly added ones (both modes).
  const [existingMilestones, setExistingMilestones] = useState<MilestoneInit[]>(
    isEditing ? (initialData?.milestones as MilestoneInit[] || []) : []
  );
  const [milestones, setMilestones] = useState<string[]>(
    !isEditing ? (initialData?.milestones as string[] || []) : []
  );
  const [milestoneInput, setMilestoneInput] = useState("");

  const [isRecurring, setIsRecurring] = useState(initialData?.isRecurring ?? false);
  const [recurrenceType, setRecurrenceType] = useState<"weekly" | "monthly">(
    (initialData?.recurrenceType as "weekly" | "monthly") ?? "monthly"
  );

  // Daily check-in settings
  const [dailyCheckIn, setDailyCheckIn] = useState(initialData?.dailyCheckIn ?? false);
  const [checkInXP, setCheckInXP] = useState(initialData?.checkInXP ?? 5);
  const [checkInDays, setCheckInDays] = useState<string | null>(initialData?.checkInDays ?? null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  }

  function addMilestone() {
    const m = milestoneInput.trim();
    if (m) setMilestones([...milestones, m]);
    setMilestoneInput("");
  }

  function toggleCheckInDay(dayIdx: number) {
    if (checkInDays === null) {
      // Was "every day" → select just this one day
      setCheckInDays(String(dayIdx));
      return;
    }
    const current = checkInDays.split(",").map(Number);
    const selected = current.includes(dayIdx);
    const next = selected ? current.filter((d) => d !== dayIdx) : [...current, dayIdx].sort((a, b) => a - b);
    setCheckInDays(next.length === 0 ? null : next.join(","));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const url = isEditing ? `/api/goals/${initialData!.id}` : "/api/goals";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        reminderTime: form.reminderTime || null,
        reminderFrequency: form.reminderTime ? reminderFrequency : null,
        reminderDay: form.reminderTime && reminderFrequency !== "daily" && reminderFrequency !== "custom" ? reminderDay : null,
        reminderDays: form.reminderTime && reminderFrequency === "custom" ? reminderDays.join(",") : null,
        tags,
        // create mode: send milestones array; edit mode: send kept IDs + new titles
        ...(isEditing
          ? {
              milestonesKept: existingMilestones.map((m) => m.id),
              milestonesAdded: milestones,
            }
          : { milestones }),
        isRecurring,
        recurrenceType: isRecurring ? recurrenceType : null,
        dailyCheckIn,
        checkInXP: dailyCheckIn ? checkInXP : undefined,
        checkInDays: dailyCheckIn ? checkInDays : undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Qualcosa è andato storto");
      setLoading(false);
    } else {
      router.push("/goals");
    }
  }

  const estimatedXP = calcXP(form.priority, milestones.length, !!form.description.trim(), !!form.targetDate);

  const inputStyle = {
    background: "var(--theme-bg)",
    borderColor: "var(--theme-surface-border)",
    color: "var(--theme-text)",
  };
  const inputClass = "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/40 focus:border-[var(--theme-accent)]/40 text-white placeholder-[var(--theme-text-muted)]";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-950/50 text-red-400 text-sm rounded-xl px-4 py-3 border border-red-800/50">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>Titolo *</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Cosa vuoi raggiungere?"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>Descrizione</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descrivi la tua missione..."
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>Difficoltà</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className={inputClass}
            style={inputStyle}
          >
            <option value="low">🍃 Bassa</option>
            <option value="medium">⚡ Media</option>
            <option value="high">🔥 Alta</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>🌙 Scadenza</label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>🔔 Promemoria</label>

        <div className="grid grid-cols-4 gap-1 mb-2 p-1 rounded-xl" style={{ background: "var(--theme-bg)" }}>
          {(["daily", "weekly", "monthly", "custom"] as ReminderFrequency[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setReminderFrequency(f)}
              className="py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
              style={
                reminderFrequency === f
                  ? { background: "var(--theme-accent)", color: "#000" }
                  : { color: "var(--theme-text-muted)" }
              }
            >
              {f === "daily" ? "Giornaliero" : f === "weekly" ? "Settimanale" : f === "monthly" ? "Mensile" : "Personalizzato"}
            </button>
          ))}
        </div>

        {reminderFrequency === "weekly" && (
          <div className="flex gap-1 mb-2">
            {WEEKDAYS.map((day, i) => (
              <button
                key={day}
                type="button"
                onClick={() => setReminderDay(i)}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={
                  reminderDay === i
                    ? { background: "var(--theme-accent)", color: "#000" }
                    : { background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", border: "1px solid" }
                }
              >
                {day}
              </button>
            ))}
          </div>
        )}

        {reminderFrequency === "monthly" && (
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Giorno del mese</label>
            <select
              value={reminderDay}
              onChange={(e) => setReminderDay(parseInt(e.target.value))}
              className="flex-1 px-3 py-2 rounded-xl border text-white text-sm focus:outline-none"
              style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        )}

        {reminderFrequency === "custom" && (
          <div className="mb-2">
            <p className="text-xs mb-1.5" style={{ color: "var(--theme-text-muted)" }}>Scegli uno o più giorni</p>
            <div className="flex gap-1">
              {WEEKDAYS.map((day, i) => {
                const selected = reminderDays.includes(i);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      if (selected && reminderDays.length === 1) return;
                      setReminderDays(selected ? reminderDays.filter((d) => d !== i) : [...reminderDays, i].sort((a, b) => a - b));
                    }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={
                      selected
                        ? { background: "var(--theme-accent)", color: "#000" }
                        : { background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", border: "1px solid" }
                    }
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            type="time"
            value={form.reminderTime}
            onChange={(e) => setForm({ ...form, reminderTime: e.target.value })}
            className={`flex-1 ${inputClass}`}
            style={inputStyle}
          />
          {form.reminderTime && (
            <button
              type="button"
              onClick={() => setForm({ ...form, reminderTime: "" })}
              className="text-xs px-3 py-3 rounded-xl border hover:text-red-400 transition-colors"
              style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
            >
              Cancella
            </button>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--theme-text-muted)" }}>
          {reminderFrequency === "weekly"
            ? `Ogni ${WEEKDAYS[reminderDay]}${form.reminderTime ? ` alle ${form.reminderTime}` : ""}`
            : reminderFrequency === "monthly"
            ? `Giorno ${reminderDay} di ogni mese${form.reminderTime ? ` alle ${form.reminderTime}` : ""}`
            : reminderFrequency === "custom"
            ? `Ogni ${reminderDays.map((d) => WEEKDAYS[d]).join(", ")}${form.reminderTime ? ` alle ${form.reminderTime}` : ""}`
            : `Ogni giorno${form.reminderTime ? ` alle ${form.reminderTime}` : ""}`}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--theme-text-muted)" }}>Categoria</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, categoryId: "" })}
            className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors border"
            style={
              form.categoryId === ""
                ? { background: "var(--theme-accent)", borderColor: "var(--theme-accent)", color: "#000" }
                : { background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }
            }
          >
            Nessuna
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setForm({ ...form, categoryId: c.id })}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors border"
              style={
                form.categoryId === c.id
                  ? { backgroundColor: c.color, borderColor: c.color, color: "#000" }
                  : { background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>Tag</label>
        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Aggiungi tag..."
            className="flex-1 px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/40 text-white placeholder-[var(--theme-text-muted)] text-sm"
            style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
          />
          <button
            type="button"
            onClick={addTag}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border hover:border-[var(--theme-accent)]/40 transition-colors"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
          >
            +
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-full border"
                style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
              >
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-0.5 hover:text-red-400">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Milestones — shown in both create and edit mode */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium" style={{ color: "var(--theme-text-muted)" }}>⭐ Milestone</label>
          {!isEditing && milestones.length > 0 && (
            <button
              type="button"
              onClick={() => setMilestones([])}
              className="text-xs hover:text-red-400 transition-colors"
              style={{ color: "var(--theme-text-muted)" }}
            >
              Rimuovi tutte ({milestones.length})
            </button>
          )}
        </div>

        {/* Existing milestones in edit mode */}
        {isEditing && existingMilestones.length > 0 && (
          <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto pr-1">
            {existingMilestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm border"
                style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                    m.completed ? "bg-amber-500 text-black" : "border"
                  }`}
                  style={m.completed ? {} : { borderColor: "var(--theme-surface-border)" }}
                >
                  {m.completed && "✓"}
                </span>
                <span
                  className={`flex-1 truncate ${m.completed ? "line-through" : "text-white"}`}
                  style={m.completed ? { color: "var(--theme-text-muted)" } : {}}
                >
                  {m.title}
                </span>
                {!m.completed && (
                  <button
                    type="button"
                    onClick={() => setExistingMilestones(existingMilestones.filter((x) => x.id !== m.id))}
                    className="hover:text-red-400 flex-shrink-0 ml-1"
                    style={{ color: "var(--theme-text-muted)" }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-2">
          <input
            value={milestoneInput}
            onChange={(e) => setMilestoneInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMilestone(); } }}
            placeholder={isEditing ? "Aggiungi nuova milestone..." : "Aggiungi una milestone..."}
            className="flex-1 px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/40 text-white placeholder-[var(--theme-text-muted)] text-sm"
            style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
          />
          <button
            type="button"
            onClick={addMilestone}
            className="px-4 py-2.5 rounded-xl text-sm font-medium border hover:border-[var(--theme-accent)]/40 transition-colors"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
          >
            +
          </button>
        </div>
        {milestones.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {milestones.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm border"
                style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {isEditing ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-700/30 flex-shrink-0">nuova</span>
                  ) : (
                    <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-semibold border flex-shrink-0 text-amber-400 bg-amber-900/40 border-amber-700/40">
                      {i + 1}
                    </span>
                  )}
                  <span className="truncate text-white">{m}</span>
                </span>
                <button type="button" onClick={() => setMilestones(milestones.filter((_, j) => j !== i))} className="hover:text-red-400 ml-2 flex-shrink-0">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3">
          <span className="text-2xl">✨</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">{estimatedXP} XP al completamento</p>
            <p className="text-xs text-amber-400/60">
              {form.priority === "low" ? "Missione facile" : form.priority === "high" ? "Missione difficile — ben ricompensata!" : "Missione media"} · aggiungi descrizione, scadenza e milestone per guadagnare di più
            </p>
          </div>
        </div>
      )}

      {/* Recurring quest toggle */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <button
          type="button"
          onClick={() => setIsRecurring(!isRecurring)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔄</span>
            <div className="text-left">
              <p className="text-sm font-medium text-[#ede9ff]">Missione ricorrente</p>
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Crea automaticamente una nuova copia al completamento</p>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isRecurring ? "bg-amber-500" : "bg-[#3b2d6e]"}`}>
            <div className={`w-5 h-5 rounded-full bg-white m-0.5 transition-transform ${isRecurring ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        </button>
        {isRecurring && (
          <div className="flex gap-2 pt-1">
            {(["weekly", "monthly"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRecurrenceType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors capitalize ${recurrenceType === t ? "border-amber-500/60 bg-amber-900/20 text-amber-300" : ""}`}
                style={recurrenceType !== t ? { borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" } : {}}
              >
                {t === "weekly" ? "Settimanale" : "Mensile"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Daily check-in toggle */}
      <div className="rounded-xl border p-4 space-y-3" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <button
          type="button"
          onClick={() => setDailyCheckIn(!dailyCheckIn)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📅</span>
            <div className="text-left">
              <p className="text-sm font-medium text-[#ede9ff]">Check-in giornaliero</p>
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Registra il progresso nei giorni pianificati e guadagna XP</p>
            </div>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${dailyCheckIn ? "bg-amber-500" : "bg-[#3b2d6e]"}`}>
            <div className={`w-5 h-5 rounded-full bg-white m-0.5 transition-transform ${dailyCheckIn ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        </button>

        {dailyCheckIn && (
          <div className="space-y-3 pt-1">
            {/* XP per check-in */}
            <div className="flex items-center gap-3">
              <label className="text-xs flex-1" style={{ color: "var(--theme-text-muted)" }}>XP per check-in</label>
              <input
                type="number"
                value={checkInXP}
                onChange={(e) => setCheckInXP(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
                min="1"
                max="50"
                className="w-20 px-3 py-2 rounded-xl border text-white text-sm text-center focus:outline-none"
                style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
              />
            </div>

            {/* Day schedule */}
            <div>
              <p className="text-xs mb-2" style={{ color: "var(--theme-text-muted)" }}>Pianificazione</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setCheckInDays(null)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap"
                  style={
                    checkInDays === null
                      ? { background: "var(--theme-accent)", borderColor: "var(--theme-accent)", color: "#000" }
                      : { background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }
                  }
                >
                  Ogni giorno
                </button>
                {WEEKDAYS.map((day, i) => {
                  const selected = checkInDays !== null && checkInDays.split(",").map(Number).includes(i);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleCheckInDay(i)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={
                        selected
                          ? { background: "var(--theme-accent)", color: "#000" }
                          : { background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", border: "1px solid" }
                      }
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              {checkInDays !== null && (
                <p className="text-xs mt-1.5" style={{ color: "var(--theme-text-muted)" }}>
                  {checkInDays.split(",").length}×/settimana · {checkInDays.split(",").map((d) => WEEKDAYS[Number(d)]).join(", ")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl font-semibold border transition-colors"
          style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
        >
          Annulla
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl font-bold disabled:opacity-60 shadow-lg shadow-amber-900/30"
        >
          {loading ? "..." : isEditing ? "✨ Salva" : "⚔️ Crea missione"}
        </button>
      </div>
    </form>
  );
}
