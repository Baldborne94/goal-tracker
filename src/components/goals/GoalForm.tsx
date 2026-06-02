"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; color: string };

type ReminderFrequency = "daily" | "weekly" | "monthly";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    tags: string[];
    milestones: string[];
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

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const GUIDE_OPTIONS = [
  { type: null as string | null, icon: "🎯", name: "No Guide", desc: "Track manually", targetLabel: "", targetPlaceholder: "" },
  { type: "finance", icon: "💰", name: "Finance", desc: "Save money", targetLabel: "Savings target (€)", targetPlaceholder: "e.g. 2000" },
  { type: "weight", icon: "⚖️", name: "Weight", desc: "Body goal", targetLabel: "Target weight (kg)", targetPlaceholder: "e.g. 70" },
  { type: "habits", icon: "🔁", name: "Habits", desc: "Build a streak", targetLabel: "Duration (days)", targetPlaceholder: "e.g. 30" },
];

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
    initialData?.reminderDay ?? (new Date().getDay())
  );
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [milestones, setMilestones] = useState<string[]>(initialData?.milestones || []);
  const [milestoneInput, setMilestoneInput] = useState("");
  const [guideType, setGuideType] = useState<string | null>(null);
  const [guideTarget, setGuideTarget] = useState("");
  const [habitFreqCount, setHabitFreqCount] = useState(1);
  const [habitFreqType, setHabitFreqType] = useState<"day" | "week">("day");
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

  function generateHabitMilestones() {
    const days = parseInt(guideTarget);
    if (!days || days <= 0) return;
    const today = new Date();
    const generated: string[] = [];

    if (habitFreqType === "day") {
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dateLabel = fmtDate(d);
        for (let j = 1; j <= habitFreqCount; j++) {
          generated.push(
            habitFreqCount > 1
              ? `Day ${i + 1} · ${dateLabel} · ${j}/${habitFreqCount}`
              : `Day ${i + 1} · ${dateLabel}`
          );
        }
      }
    } else {
      const weeks = Math.ceil(days / 7);
      for (let i = 0; i < weeks; i++) {
        const start = new Date(today);
        start.setDate(start.getDate() + i * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const weekLabel = `${fmtDate(start)} – ${fmtDate(end)}`;
        for (let j = 1; j <= habitFreqCount; j++) {
          generated.push(
            habitFreqCount > 1
              ? `Week ${i + 1} · ${weekLabel} · session ${j}/${habitFreqCount}`
              : `Week ${i + 1} · ${weekLabel}`
          );
        }
      }
    }

    setMilestones(generated);

    if (!form.targetDate) {
      const deadline = new Date(today);
      deadline.setDate(deadline.getDate() + days - 1);
      const iso = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, "0")}-${String(deadline.getDate()).padStart(2, "0")}`;
      setForm((f) => ({ ...f, targetDate: iso }));
    }
  }

  const habitTotalMilestones = (() => {
    const days = parseInt(guideTarget);
    if (!days || days <= 0) return 0;
    return habitFreqType === "day"
      ? habitFreqCount * days
      : habitFreqCount * Math.ceil(days / 7);
  })();

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
        reminderDay: form.reminderTime && reminderFrequency !== "daily" ? reminderDay : null,
        tags,
        milestones,
        guideType: guideType || null,
        guideTarget: guideTarget ? parseFloat(guideTarget) : null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setLoading(false);
    } else {
      router.push(`/goals`);
    }
  }

  const estimatedXP = calcXP(form.priority, milestones.length, !!form.description.trim(), !!form.targetDate);
  const selectedGuide = GUIDE_OPTIONS.find((g) => g.type === guideType);

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
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>Title *</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What do you want to achieve?"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>Description</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describe your quest..."
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>Difficulty</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className={inputClass}
            style={inputStyle}
          >
            <option value="low">🍃 Low</option>
            <option value="medium">⚡ Medium</option>
            <option value="high">🔥 High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>🌙 Deadline</label>
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
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>🔔 Reminder</label>

        {/* Frequency tabs */}
        <div className="flex gap-1 mb-2 p-1 rounded-xl" style={{ background: "var(--theme-bg)" }}>
          {(["daily", "weekly", "monthly"] as ReminderFrequency[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setReminderFrequency(f)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
              style={
                reminderFrequency === f
                  ? { background: "var(--theme-accent)", color: "#000" }
                  : { color: "var(--theme-text-muted)" }
              }
            >
              {f}
            </button>
          ))}
        </div>

        {/* Day picker for weekly */}
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

        {/* Day picker for monthly */}
        {reminderFrequency === "monthly" && (
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Day of month</label>
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

        {/* Time picker */}
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
              Clear
            </button>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: "var(--theme-text-muted)" }}>
          {reminderFrequency === "weekly"
            ? `Push notification every ${WEEKDAYS[reminderDay]}${form.reminderTime ? ` at ${form.reminderTime}` : ""}`
            : reminderFrequency === "monthly"
            ? `Push notification on day ${reminderDay} of each month${form.reminderTime ? ` at ${form.reminderTime}` : ""}`
            : `Push notification every day${form.reminderTime ? ` at ${form.reminderTime}` : ""}`}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: "var(--theme-text-muted)" }}>Category</label>
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
            None
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
        <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>Tags</label>
        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Add tag..."
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

      {!isEditing && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium" style={{ color: "var(--theme-text-muted)" }}>⭐ Milestones / Sub-goals</label>
            {milestones.length > 0 && (
              <button
                type="button"
                onClick={() => setMilestones([])}
                className="text-xs hover:text-red-400 transition-colors"
                style={{ color: "var(--theme-text-muted)" }}
              >
                Clear all ({milestones.length})
              </button>
            )}
          </div>
          <div className="flex gap-2 mb-2">
            <input
              value={milestoneInput}
              onChange={(e) => setMilestoneInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMilestone(); } }}
              placeholder="Add a milestone..."
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
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {milestones.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-sm border"
                  style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-semibold border flex-shrink-0 text-amber-400 bg-amber-900/40 border-amber-700/40">
                      {i + 1}
                    </span>
                    <span className="truncate text-white">{m}</span>
                  </span>
                  <button type="button" onClick={() => setMilestones(milestones.filter((_, j) => j !== i))} className="hover:text-red-400 ml-2 flex-shrink-0">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isEditing && (
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>🧭 Guide</label>
          <p className="text-xs mb-3" style={{ color: "var(--theme-text-muted)" }}>Pick a tracker to help you reach this quest automatically.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {GUIDE_OPTIONS.map((g) => (
              <button
                key={String(g.type)}
                type="button"
                onClick={() => { setGuideType(g.type); setGuideTarget(""); }}
                className="p-3 rounded-xl border text-left transition-colors"
                style={
                  guideType === g.type
                    ? { borderColor: "var(--theme-accent)", background: "var(--theme-accent-bg, color-mix(in srgb, var(--theme-accent) 15%, transparent))" }
                    : { borderColor: "var(--theme-surface-border)", background: "var(--theme-surface)" }
                }
              >
                <div className="text-xl mb-1">{g.icon}</div>
                <div className="text-sm font-medium text-white">{g.name}</div>
                <div className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{g.desc}</div>
              </button>
            ))}
          </div>

          {guideType && selectedGuide?.targetLabel && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--theme-text-muted)" }}>
                {selectedGuide.targetLabel}
              </label>
              <input
                type="number"
                value={guideTarget}
                onChange={(e) => setGuideTarget(e.target.value)}
                placeholder={selectedGuide.targetPlaceholder}
                min="0"
                step="0.01"
                className={inputClass}
                style={inputStyle}
              />

              {guideType === "habits" && guideTarget && parseInt(guideTarget) > 0 && (
                <div className="mt-3 p-4 rounded-xl border space-y-3" style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--theme-text-muted)" }}>🗓 Auto-generate sub-quests</p>
                  <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                    Specify how often you want to do this — a checkbox will be created for each occurrence.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={habitFreqCount}
                      onChange={(e) => setHabitFreqCount(Math.max(1, parseInt(e.target.value) || 1))}
                      min="1"
                      max="24"
                      className="w-16 px-2 py-2.5 rounded-xl border text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/40"
                      style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
                    />
                    <span className="text-sm" style={{ color: "var(--theme-text-muted)" }}>times per</span>
                    <select
                      value={habitFreqType}
                      onChange={(e) => setHabitFreqType(e.target.value as "day" | "week")}
                      className="flex-1 px-3 py-2.5 rounded-xl border text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]/40"
                      style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
                    >
                      <option value="day">day</option>
                      <option value="week">week</option>
                    </select>
                  </div>
                  <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                    → {habitTotalMilestones} checkboxes will be generated
                    {habitFreqType === "day"
                      ? ` (${habitFreqCount}×/day × ${parseInt(guideTarget)} days)`
                      : ` (${habitFreqCount}×/week × ${Math.ceil(parseInt(guideTarget) / 7)} weeks)`}
                  </p>
                  <button
                    type="button"
                    onClick={generateHabitMilestones}
                    className="w-full py-2.5 rounded-xl bg-amber-900/20 border border-amber-700/30 text-amber-300 text-sm font-semibold hover:bg-amber-900/30 transition-colors"
                  >
                    ✨ Generate {habitTotalMilestones} sub-quests
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!isEditing && (
        <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3">
          <span className="text-2xl">✨</span>
          <div>
            <p className="text-sm font-semibold text-amber-300">{estimatedXP} XP on completion</p>
            <p className="text-xs text-amber-400/60">
              {form.priority === "low" ? "Easy quest" : form.priority === "high" ? "Hard quest — well rewarded!" : "Medium quest"} · add description, deadline & milestones to earn more
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl font-semibold border transition-colors"
          style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl font-bold disabled:opacity-60 shadow-lg shadow-amber-900/30"
        >
          {loading ? "..." : isEditing ? "✨ Save" : "⚔️ Create quest"}
        </button>
      </div>
    </form>
  );
}
