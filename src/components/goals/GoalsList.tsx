"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, getPriorityColor, getPriorityLabel } from "@/lib/utils";

type Category = { id: string; name: string; color: string };
type Tag = { id: string; name: string };
type Milestone = { id: string; title: string; completed: boolean };
type GoalTag = { tag: Tag };
type Goal = { id: string; title: string; description: string | null; status: string; priority: string; progress: number; targetDate: string | null; category: Category | null; milestones: Milestone[]; tags: GoalTag[] };
type Props = { goals: Goal[]; categories: Category[] };

export default function GoalsList({ goals, categories }: Props) {
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const filtered = goals.filter((g) => {
    if (filter === "active" && g.status !== "active") return false;
    if (filter === "completed" && g.status !== "completed") return false;
    if (categoryId !== "all" && g.category?.id !== categoryId) return false;
    return true;
  });
  return (
    <>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(["all", "active", "completed"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
            {f === "all" ? "Tutti" : f === "active" ? "Attivi" : "Completati"}
          </button>
        ))}
      </div>
      {categories.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <button onClick={() => setCategoryId("all")} className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${categoryId === "all" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>Tutte</button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategoryId(c.id)} className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${categoryId === c.id ? "text-white" : "bg-white text-slate-600"}`} style={categoryId === c.id ? { backgroundColor: c.color, borderColor: c.color } : { borderColor: "#e2e8f0" }}>{c.name}</button>
          ))}
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-slate-500 text-sm">Nessun obiettivo trovato</p>
          <Link href="/goals/new" className="inline-block mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold">Crea obiettivo</Link>
        </div>
      ) : (
        <div className="space-y-3">{filtered.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</div>
      )}
    </>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const milestonesDone = goal.milestones.filter((m) => m.completed).length;
  const milestonesTotal = goal.milestones.length;
  return (
    <Link href={`/goals/${goal.id}`} className="block bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:border-indigo-200 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-slate-800 line-clamp-2 flex-1">{goal.title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${goal.status === "completed" ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"}`}>
          {goal.status === "completed" ? "✓ Fatto" : "• Attivo"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {goal.category && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: goal.category.color + "20", color: goal.category.color }}>{goal.category.name}</span>}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityColor(goal.priority)}`}>{getPriorityLabel(goal.priority)}</span>
        {goal.tags.slice(0, 2).map(({ tag }) => <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">#{tag.name}</span>)}
      </div>
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>{milestonesTotal > 0 ? `${milestonesDone}/${milestonesTotal} milestone` : "Progresso"}</span>
          <span>{goal.progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${goal.progress >= 100 ? "bg-green-500" : goal.progress >= 50 ? "bg-indigo-500" : "bg-indigo-400"}`} style={{ width: `${goal.progress}%` }} />
        </div>
      </div>
      {goal.targetDate && <p className="text-xs text-slate-400 mt-2">📅 {formatDate(goal.targetDate)}</p>}
    </Link>
  );
}
