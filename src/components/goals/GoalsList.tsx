"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, getPriorityColor, getPriorityLabel } from "@/lib/utils";

type Category = { id: string; name: string; color: string };
type Tag = { id: string; name: string };
type Milestone = { id: string; title: string; completed: boolean };
type GoalTag = { tag: Tag };

type Goal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  targetDate: string | null;
  category: Category | null;
  milestones: Milestone[];
  tags: GoalTag[];
};

type Props = {
  goals: Goal[];
  categories: Category[];
};

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
      {/* Status filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(["all", "active", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              filter === f
                ? "bg-amber-500 text-black border-amber-500 font-bold"
                : "bg-[#16112e] text-[#9d8ac7] border-[#3b2d6e] hover:border-amber-500/40"
            }`}
          >
            {f === "all" ? "Tutte" : f === "active" ? "⚡ Attive" : "👑 Completate"}
          </button>
        ))}
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryId("all")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              categoryId === "all"
                ? "bg-[#ede9ff] text-[#0c0a1a] border-[#ede9ff]"
                : "bg-[#16112e] text-[#9d8ac7] border-[#3b2d6e]"
            }`}
          >
            Tutte
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                categoryId === c.id ? "text-black" : "bg-[#16112e] text-[#9d8ac7]"
              }`}
              style={
                categoryId === c.id
                  ? { backgroundColor: c.color, borderColor: c.color }
                  : { borderColor: "#3b2d6e" }
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-8 text-center">
          <div className="text-4xl mb-3">🗡️</div>
          <p className="text-[#9d8ac7] text-sm">Nessuna missione trovata</p>
          <Link
            href="/goals/new"
            className="inline-block mt-4 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold"
          >
            Crea missione
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const milestonesDone = goal.milestones.filter((m) => m.completed).length;
  const milestonesTotal = goal.milestones.length;

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-4 hover:border-amber-500/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-[#ede9ff] line-clamp-2 flex-1">{goal.title}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium border ${
            goal.status === "completed"
              ? "bg-amber-900/30 text-amber-300 border-amber-700/40"
              : "bg-violet-900/30 text-violet-300 border-violet-700/40"
          }`}
        >
          {goal.status === "completed" ? "👑" : "⚡"}{" "}
          {goal.status === "completed" ? "Fatto" : "Attiva"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {goal.category && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: goal.category.color + "25",
              color: goal.category.color,
            }}
          >
            {goal.category.name}
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityColor(goal.priority)}`}>
          {getPriorityLabel(goal.priority)}
        </span>
        {goal.tags.slice(0, 2).map(({ tag }) => (
          <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-[#1e1740] text-[#9d8ac7] border border-[#3b2d6e]">
            #{tag.name}
          </span>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-[#6b5a9e] mb-1">
          <span>
            {milestonesTotal > 0 ? `${milestonesDone}/${milestonesTotal} tappe` : "Progresso"}
          </span>
          <span className="text-amber-400/80">{goal.progress}%</span>
        </div>
        <div className="h-2 bg-[#0f0d22] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
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

      {goal.targetDate && (
        <p className="text-xs text-[#6b5a9e] mt-2">
          🌙 {formatDate(goal.targetDate)}
        </p>
      )}
    </Link>
  );
}
