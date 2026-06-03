"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Milestone = { id: string; title: string; completed: boolean; order: number };
type Tag = { id: string; name: string };
type GoalTag = { tag: Tag };
type Category = { id: string; name: string; color: string } | null;
type CheckIn = { id: string; date: string; note: string | null; xpAwarded: number };

type Goal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  targetDate: string | null;
  completedAt: string | null;
  points: number;
  category: Category;
  milestones: Milestone[];
  tags: GoalTag[];
  reminderTime: string | null;
  dailyCheckIn: boolean;
  checkInXP: number;
  checkInDays: string | null;
};

type Props = {
  goal: Goal;
  priorityLabel: string;
  priorityColor: string;
  formattedDate: string | null;
  checkIns: CheckIn[];
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function calcStreak(checkIns: CheckIn[], checkInDays: string | null): number {
  if (checkIns.length === 0) return 0;
  const checked = new Set(checkIns.map((c) => c.date));
  const scheduledDays = checkInDays ? checkInDays.split(",").map(Number) : [0, 1, 2, 3, 4, 5, 6];
  const todayStr = new Date().toISOString().slice(0, 10);
  let streak = 0;
  const cursor = new Date(todayStr + "T12:00:00");
  for (let i = 0; i < 365; i++) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (scheduledDays.includes(cursor.getDay())) {
      if (checked.has(dateStr)) {
        streak++;
      } else if (dateStr < todayStr) {
        break; // missed a scheduled day in the past
      }
      // today not yet checked in → don't break
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function scheduleLabel(checkInDays: string | null): string {
  if (!checkInDays) return "Every day";
  const days = checkInDays.split(",").map((d) => WEEKDAYS[Number(d)]);
  return `${days.length}×/week · ${days.join(", ")}`;
}

function isTodayScheduled(checkInDays: string | null): boolean {
  if (!checkInDays) return true;
  return checkInDays.split(",").map(Number).includes(new Date().getDay());
}

export default function GoalDetailClient({ goal: initial, priorityLabel, priorityColor, formattedDate, checkIns: initialCheckIns }: Props) {
  const router = useRouter();
  const [goal, setGoal] = useState(initial);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const [checkIns, setCheckIns] = useState<CheckIn[]>(initialCheckIns);
  const [todayNote, setTodayNote] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCheckedIn = checkIns.some((c) => c.date === todayStr);
  const streak = calcStreak(checkIns, goal.checkInDays);
  const scheduledToday = isTodayScheduled(goal.checkInDays);

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    return d.toISOString().slice(0, 10);
  });

  async function handleCheckIn() {
    setCheckingIn(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: todayNote || null }),
      });
      if (res.ok) {
        const { id, date, xp } = await res.json();
        setCheckIns((prev) => [{ id, date, note: todayNote || null, xpAwarded: xp }, ...prev]);
        setTodayNote("");
      }
    } finally {
      setCheckingIn(false);
    }
  }

  async function shareTemplate() {
    const data = {
      title: goal.title,
      description: goal.description ?? "",
      priority: goal.priority,
      milestones: goal.milestones.map((m) => m.title),
    };
    const encoded = btoa(JSON.stringify(data));
    const url = `${window.location.origin}/goals/new?template=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function toggleMilestone(milestoneId: string, completed: boolean) {
    const res = await fetch(`/api/goals/${goal.id}/milestones`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneId, completed }),
    });
    if (res.ok) {
      const { progress } = await res.json();
      setGoal((prev) => ({
        ...prev,
        progress,
        status: progress === 100 ? "completed" : "active",
        milestones: prev.milestones.map((m) => m.id === milestoneId ? { ...m, completed } : m),
      }));
      router.refresh();
    }
  }

  async function markComplete() {
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", progress: 100 }),
    });
    if (res.ok) {
      const updated = await res.json();
      setGoal(updated);
      router.refresh();
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    if (res.ok) router.push("/goals");
    else setDeleting(false);
  }

  const isCompleted = goal.status === "completed";
  const isArchived = goal.status === "archived";

  async function handleArchive() {
    const newStatus = isArchived ? "active" : "archived";
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setGoal((prev) => ({ ...prev, status: newStatus }));
      if (!isArchived) router.push("/goals");
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <button
        onClick={() => router.push("/goals")}
        className="flex items-center gap-1.5 text-[#9d8ac7] text-sm mb-5 hover:text-amber-400 transition-colors"
      >
        ← Back
      </button>

      {/* Main goal card */}
      <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-xl font-bold text-[#ede9ff] flex-1">{goal.title}</h1>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 border ${
              isCompleted
                ? "bg-amber-900/30 text-amber-300 border-amber-700/40"
                : isArchived
                ? "bg-zinc-800/60 text-zinc-400 border-zinc-600/40"
                : "bg-violet-900/30 text-violet-300 border-violet-700/40"
            }`}
          >
            {isCompleted ? "👑 Completed" : isArchived ? "📦 Archived" : "⚡ Active"}
          </span>
        </div>

        {goal.description && (
          <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>{goal.description}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {goal.category && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ backgroundColor: goal.category.color + "25", color: goal.category.color }}
            >
              {goal.category.name}
            </span>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priorityColor}`}>
            {priorityLabel}
          </span>
          {goal.tags.map(({ tag }) => (
            <span key={tag.id} className="text-xs px-2.5 py-1 rounded-full border" style={{ background: "var(--theme-bg)", color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }}>
              #{tag.name}
            </span>
          ))}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium" style={{ color: "var(--theme-text-muted)" }}>Progress</span>
            <span className="font-bold text-amber-400">{goal.progress}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "var(--theme-bg)" }}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                goal.progress >= 100 ? "bg-amber-400" : goal.progress >= 50 ? "bg-violet-500" : "bg-violet-700"
              }`}
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>

        <div className="flex gap-4 text-sm flex-wrap" style={{ color: "var(--theme-text-muted)" }}>
          <div className="flex items-center gap-1">
            <span>✨</span>
            <span>{goal.points} XP</span>
          </div>
          {formattedDate && (
            <div className="flex items-center gap-1">
              <span>🌙</span>
              <span>{formattedDate}</span>
            </div>
          )}
          {goal.reminderTime && (
            <div className="flex items-center gap-1">
              <span>🔔</span>
              <span>{goal.reminderTime} daily</span>
            </div>
          )}
          {goal.dailyCheckIn && (
            <div className="flex items-center gap-1">
              <span>📅</span>
              <span>{scheduleLabel(goal.checkInDays)}</span>
            </div>
          )}
        </div>

        {isCompleted && (
          <div className="mt-4 p-3 rounded-xl flex items-center gap-2" style={{ background: "linear-gradient(135deg, #78350f33, #92400e22)", border: "1px solid #92400e66" }}>
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-amber-300 font-semibold text-sm">Quest complete!</p>
              <p className="text-amber-400/70 text-xs">You earned {goal.points} XP</p>
            </div>
          </div>
        )}
      </div>

      {/* Daily check-in card */}
      {goal.dailyCheckIn && (
        <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#ede9ff]">📅 Daily Check-in</h2>
            <span className="text-xs font-bold text-amber-400">+{goal.checkInXP} XP</span>
          </div>

          {/* Stats row */}
          <div className="flex gap-5 mb-4">
            <div>
              <p className="font-bold text-amber-400 text-sm">{streak > 0 ? `🔥 ${streak}` : "—"}</p>
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>streak</p>
            </div>
            <div>
              <p className="font-bold text-amber-400 text-sm">{checkIns.length}</p>
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>total</p>
            </div>
            <div className="flex-1 text-right">
              <p className="font-medium text-xs text-[#ede9ff]">{scheduleLabel(goal.checkInDays)}</p>
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>schedule</p>
            </div>
          </div>

          {/* Mini calendar — last 14 days */}
          <div className="flex gap-1 mb-4">
            {last14.map((date) => {
              const checked = checkIns.some((c) => c.date === date);
              const isToday = date === todayStr;
              const dayIdx = new Date(date + "T12:00:00").getDay();
              const scheduled = !goal.checkInDays || goal.checkInDays.split(",").map(Number).includes(dayIdx);
              return (
                <div
                  key={date}
                  title={`${date}${checked ? " ✓" : ""}`}
                  className={`flex-1 h-5 rounded-md transition-colors ${
                    checked ? "bg-amber-400" : scheduled ? "bg-zinc-700/60" : "bg-zinc-900/30"
                  } ${isToday ? "ring-2 ring-amber-500" : ""}`}
                />
              );
            })}
          </div>

          {/* Action area */}
          {scheduledToday ? (
            todayCheckedIn ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-900/20 border border-amber-700/30">
                <span className="text-lg">✅</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300">Checked in today!</p>
                  {checkIns.find((c) => c.date === todayStr)?.note && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--theme-text-muted)" }}>
                      {checkIns.find((c) => c.date === todayStr)!.note}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={todayNote}
                  onChange={(e) => setTodayNote(e.target.value)}
                  placeholder="Today's note (optional)..."
                  className="w-full px-3 py-2.5 rounded-xl border text-sm text-white placeholder-[var(--theme-text-muted)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                />
                <button
                  onClick={handleCheckIn}
                  disabled={checkingIn}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }}
                >
                  {checkingIn ? "..." : `✓ Check in today  +${goal.checkInXP} XP`}
                </button>
              </div>
            )
          ) : (
            <p className="text-sm text-center py-2" style={{ color: "var(--theme-text-muted)" }}>
              Not scheduled today — next scheduled day: {WEEKDAYS[goal.checkInDays!.split(",").map(Number).find((d) => d > new Date().getDay()) ?? Number(goal.checkInDays!.split(",")[0])]}
            </p>
          )}
        </div>
      )}

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <h2 className="font-semibold text-[#ede9ff] mb-3">
            ⭐ Milestones{" "}
            <span className="text-sm font-normal" style={{ color: "var(--theme-text-muted)" }}>
              {goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length}
            </span>
          </h2>
          <div className="space-y-3">
            {goal.milestones.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  m.completed ? "bg-amber-900/20 border border-amber-700/30" : "border"
                }`}
                style={m.completed ? {} : { background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                onClick={() => !isCompleted && !isArchived && toggleMilestone(m.id, !m.completed)}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors border-2 ${
                    m.completed ? "bg-amber-500 border-amber-500 text-black" : "bg-transparent"
                  }`}
                  style={m.completed ? {} : { borderColor: "var(--theme-surface-border)" }}
                >
                  {m.completed && (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm flex-1 ${m.completed ? "line-through" : "text-[#ede9ff]"}`} style={m.completed ? { color: "var(--theme-text-muted)" } : {}}>
                  {m.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isCompleted && (
        <div className="space-y-3 mb-4">
          <button
            onClick={markComplete}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl font-bold hover:from-amber-400 hover:to-yellow-300 active:scale-95 transition-all shadow-lg shadow-amber-900/30"
          >
            👑 Complete quest
          </button>
        </div>
      )}

      {!isCompleted && !isArchived && (
        <Link
          href={`/goals/${goal.id}/edit`}
          className="block w-full py-3 rounded-xl font-semibold text-center border transition-colors mb-3 text-[#ede9ff]"
          style={{ borderColor: "var(--theme-surface-border)", background: "var(--theme-surface)" }}
        >
          ✏️ Edit
        </Link>
      )}

      <button
        onClick={shareTemplate}
        className="w-full py-3 rounded-xl font-semibold border transition-colors mb-3"
        style={{ borderColor: "var(--theme-surface-border)", background: "var(--theme-surface)", color: "var(--theme-text-muted)" }}
      >
        {copied ? "✅ Link copied!" : "📤 Share as template"}
      </button>

      {!isCompleted && (
        <button
          onClick={handleArchive}
          className="w-full py-3 rounded-xl font-semibold border transition-colors mb-3"
          style={{ borderColor: "var(--theme-surface-border)", background: "var(--theme-surface)", color: "var(--theme-text-muted)" }}
        >
          {isArchived ? "📂 Unarchive quest" : "📦 Archive quest"}
        </button>
      )}

      <button
        onClick={() => setShowDelete(true)}
        className="w-full py-3 border border-red-900/50 text-red-400 rounded-xl font-semibold hover:bg-red-950/30 transition-colors"
      >
        🗑 Delete quest
      </button>

      {showDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[60] p-4 pb-24">
          <div className="rounded-2xl border w-full max-w-sm p-6" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <h3 className="text-lg font-bold text-[#ede9ff] mb-2">Delete quest</h3>
            <p className="text-sm mb-5" style={{ color: "var(--theme-text-muted)" }}>
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-3 rounded-xl font-semibold border"
                style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-900 text-red-200 rounded-xl font-semibold disabled:opacity-60 border border-red-800"
              >
                {deleting ? "..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
