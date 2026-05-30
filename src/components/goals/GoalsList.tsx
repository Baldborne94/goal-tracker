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

type Suggestion = { icon: string; title: string; desc: string };

const SUGGESTIONS: Record<string, Suggestion[]> = {
  _all: [
    { icon: "🏃", title: "Run 5km three times a week for a month", desc: "Cardio · Health" },
    { icon: "💧", title: "Drink 2L of water every day for 21 days", desc: "Hydration · Health" },
    { icon: "😴", title: "Sleep 8 hours every night for 30 days", desc: "Recovery · Health" },
    { icon: "🧘", title: "Meditate 10 minutes every day for 21 days", desc: "Mindfulness · Health" },
    { icon: "📚", title: "Read 1 book this month", desc: "Personal growth" },
    { icon: "📓", title: "Journal every day for 30 days", desc: "Reflection · Personal" },
    { icon: "📵", title: "No social media for 7 days", desc: "Digital detox · Personal" },
    { icon: "💰", title: "Save €200 this month", desc: "Finance" },
  ],
  Health: [
    { icon: "🏃", title: "Run 5km three times a week for a month", desc: "Cardio challenge" },
    { icon: "💧", title: "Drink 2L of water every day for 21 days", desc: "Hydration habit" },
    { icon: "😴", title: "Sleep 8 hours every night for 30 days", desc: "Sleep routine" },
    { icon: "💪", title: "Do 30 push-ups every day for 30 days", desc: "Strength habit" },
    { icon: "🧘", title: "Meditate 10 minutes every day for 21 days", desc: "Mindfulness" },
    { icon: "🚶", title: "Walk 10,000 steps every day for 2 weeks", desc: "Daily movement" },
    { icon: "🥗", title: "Eat vegetables with every meal for 2 weeks", desc: "Nutrition habit" },
    { icon: "🚫", title: "No alcohol for 30 days", desc: "Detox challenge" },
    { icon: "🚴", title: "Cycle or walk to work for 1 month", desc: "Active commute" },
    { icon: "🌅", title: "Morning stretch routine every day for 21 days", desc: "Flexibility habit" },
  ],
  Finance: [
    { icon: "💰", title: "Save €200 this month", desc: "Monthly savings goal" },
    { icon: "🧾", title: "Track every expense for 30 days", desc: "Financial awareness" },
    { icon: "🍳", title: "Cook at home 5 days a week for a month", desc: "Cut eating-out costs" },
    { icon: "📊", title: "Cancel all unused subscriptions this week", desc: "Reduce fixed costs" },
    { icon: "🎯", title: "Build a €500 emergency fund in 3 months", desc: "Financial security" },
  ],
  Personal: [
    { icon: "📚", title: "Read 1 book this month", desc: "Reading habit" },
    { icon: "📵", title: "No social media for 7 days", desc: "Digital detox" },
    { icon: "🌅", title: "Morning routine every day for 21 days", desc: "Intentional start" },
    { icon: "📓", title: "Journal every day for 30 days", desc: "Daily reflection" },
    { icon: "🧹", title: "Declutter one room this week", desc: "Organize your space" },
    { icon: "🤝", title: "Spend quality time with family once a week", desc: "Relationships" },
  ],
  Learning: [
    { icon: "💻", title: "Complete an online course this month", desc: "New skill" },
    { icon: "🗣️", title: "Learn 5 new words in a language every day for 30 days", desc: "Language learning" },
    { icon: "🎸", title: "Practice an instrument for 20 min every day for 30 days", desc: "Music skill" },
    { icon: "✍️", title: "Write 500 words every day for 30 days", desc: "Writing practice" },
    { icon: "📺", title: "Watch 1 educational video every day for 2 weeks", desc: "Daily learning" },
  ],
  Work: [
    { icon: "📋", title: "Plan your week every Sunday for a month", desc: "Weekly planning" },
    { icon: "⏰", title: "2h deep work session with no distractions every day for 30 days", desc: "Focus habit" },
    { icon: "🤝", title: "Network with 2 new people this month", desc: "Career growth" },
    { icon: "🎯", title: "Complete one key project this month", desc: "Focus on what matters" },
  ],
};

export default function GoalsList({ goals, categories }: Props) {
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [showSuggestions, setShowSuggestions] = useState(goals.length === 0);

  const filtered = goals.filter((g) => {
    if (filter === "active" && g.status !== "active") return false;
    if (filter === "completed" && g.status !== "completed") return false;
    if (categoryId !== "all" && g.category?.id !== categoryId) return false;
    return true;
  });

  const activeCategoryName = categoryId === "all"
    ? null
    : categories.find((c) => c.id === categoryId)?.name ?? null;

  const suggestions: Suggestion[] =
    activeCategoryName && SUGGESTIONS[activeCategoryName]
      ? SUGGESTIONS[activeCategoryName]
      : SUGGESTIONS._all;

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
            {f === "all" ? "All" : f === "active" ? "⚡ Active" : "👑 Completed"}
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
            All
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
        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-8 text-center mb-4">
          <div className="text-4xl mb-3">🗡️</div>
          <p className="text-[#9d8ac7] text-sm">No quests found</p>
          <Link
            href="/goals/new"
            className="inline-block mt-4 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold"
          >
            Create quest
          </Link>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {filtered.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      {/* Quest suggestions */}
      <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] overflow-hidden">
        <button
          onClick={() => setShowSuggestions((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-[#c4b5fd]">
            💡 Quest ideas{activeCategoryName ? ` · ${activeCategoryName}` : ""}
          </span>
          <span className="text-[#6b5a9e] text-xs">{showSuggestions ? "▲" : "▼"}</span>
        </button>

        {showSuggestions && (
          <div className="px-5 pb-5 space-y-2">
            {suggestions.map((s) => (
              <Link
                key={s.title}
                href={`/goals/new?title=${encodeURIComponent(s.title)}`}
                className="flex items-center gap-3 bg-[#0f0d22] rounded-xl px-3 py-2.5 border border-[#2a1f50] hover:border-amber-500/30 transition-colors group"
              >
                <span className="text-xl flex-shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#ede9ff] leading-snug">{s.title}</p>
                  <p className="text-xs text-[#6b5a9e] mt-0.5">{s.desc}</p>
                </div>
                <span className="text-[#3b2d6e] group-hover:text-amber-400 transition-colors text-lg flex-shrink-0">+</span>
              </Link>
            ))}
          </div>
        )}
      </div>
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
          {goal.status === "completed" ? "Done" : "Active"}
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
            {milestonesTotal > 0 ? `${milestonesDone}/${milestonesTotal} milestones` : "Progress"}
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
