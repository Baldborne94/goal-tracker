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

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-slate-500 text-sm mb-5 hover:text-slate-700"
      >
        ← Indietro
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-xl font-bold text-slate-800 flex-1">{goal.title}</h1>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${
              isCompleted ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"
            }`}
          >
            {isCompleted ? "✓ Completato" : "● Attivo"}
          </span>
        </div>

        {goal.description && (
          <p className="text-slate-600 text-sm mb-4 leading-relaxed">{goal.description}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {goal.category && (
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: goal.category.color + "20",
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
            <span key={tag.id} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              #{tag.name}
            </span>
          ))}
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-slate-600 font-medium">Progresso</span>
            <span className="font-bold text-slate-800">{goal.progress}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                goal.progress >= 100
                  ? "bg-green-500"
                  : goal.progress >= 50
                  ? "bg-indigo-500"
                  : "bg-indigo-400"
              }`}
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>

        <div className="flex gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1">
            <span>🏆</span>
            <span>{goal.points} punti</span>
          </div>
          {formattedDate && (
            <div className="flex items-center gap-1">
              <span>📅</span>
              <span>{formattedDate}</span>
            </div>
          )}
        </div>

        {isCompleted && (
          <div className="mt-4 p-3 bg-green-50 rounded-xl flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-green-700 font-semibold text-sm">Obiettivo completato!</p>
              <p className="text-green-600 text-xs">Hai guadagnato {goal.points} punti</p>
            </div>
          </div>
        )}
      </div>

      {/* Milestones */}
      {goal.milestones.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-3">
            Milestone{" "}
            <span className="text-sm font-normal text-slate-400">
              {goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length}
            </span>
          </h2>
          <div className="space-y-3">
            {goal.milestones.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  m.completed ? "bg-green-50" : "bg-slate-50"
                }`}
                onClick={() => !isCompleted && toggleMilestone(m.id, !m.completed)}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    m.completed
                      ? "bg-green-500 text-white"
                      : "bg-white border-2 border-slate-300"
                  }`}
                >
                  {m.completed && (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm flex-1 ${
                    m.completed ? "line-through text-slate-400" : "text-slate-700"
                  }`}
                >
                  {m.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {!isCompleted && (
        <div className="space-y-3 mb-4">
          <button
            onClick={markComplete}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 active:scale-95 transition-all"
          >
            🎉 Segna come completato
          </button>
          <Link
            href={`/goals/${goal.id}/edit`}
            className="block w-full py-3 border border-indigo-200 text-indigo-600 rounded-xl font-semibold text-center hover:bg-indigo-50"
          >
            ✏️ Modifica
          </Link>
        </div>
      )}

      <button
        onClick={() => setShowDelete(true)}
        className="w-full py-3 border border-red-200 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition-colors"
      >
        🗑 Elimina obiettivo
      </button>

      {/* Delete modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Elimina obiettivo</h3>
            <p className="text-slate-500 text-sm mb-5">
              Sei sicuro? Questa azione è irreversibile.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold"
              >
                Annulla
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold disabled:opacity-60"
              >
                {deleting ? "..." : "Elimina"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
