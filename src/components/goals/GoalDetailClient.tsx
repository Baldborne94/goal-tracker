"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Milestone = { id: string; title: string; completed: boolean; order: number };
type Tag = { id: string; name: string };
type GoalTag = { tag: Tag };
type Category = { id: string; name: string; color: string } | null;

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
};

type Props = {
  goal: Goal;
  priorityLabel: string;
  priorityColor: string;
  formattedDate: string | null;
};

export default function GoalDetailClient({ goal: initial, priorityLabel, priorityColor, formattedDate }: Props) {
  const router = useRouter();
  const [goal, setGoal] = useState(initial);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);

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

  function handleProgressUpdate(progress: number) {
    setGoal((prev) => ({
      ...prev,
      progress,
      status: progress >= 100 ? "completed" : "active",
    }));
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
        milestones: prev.milestones.map((m) =>
          m.id === milestoneId ? { ...m, completed } : m
        ),
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
              style={{
                backgroundColor: goal.category.color + "25",
                color: goal.category.color,
              }}
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
                goal.progress >= 100
                  ? "bg-amber-400"
                  : goal.progress >= 50
                  ? "bg-violet-500"
                  : "bg-violet-700"
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
        </div>

        {isCompleted && (
          <div className="mt-4 p-3 rounded-xl flex items-center gap-2" style={{background: "linear-gradient(135deg, #78350f33, #92400e22)", border: "1px solid #92400e66"}}>
            <span className="text-2xl">👑</span>
            <div>
              <p className="text-amber-300 font-semibold text-sm">Quest complete!</p>
              <p className="text-amber-400/70 text-xs">You earned {goal.points} XP</p>
            </div>
          </div>
        )}
      </div>

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
