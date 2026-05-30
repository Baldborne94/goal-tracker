"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; color: string };

type Props = {
  categories: Category[];
  initialData?: {
    id?: string;
    title: string;
    description: string;
    priority: string;
    targetDate: string;
    categoryId: string;
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

const GUIDE_OPTIONS = [
  { type: null as string | null, icon: "🎯", name: "No Guide", desc: "Track manually", targetLabel: "", targetPlaceholder: "" },
  { type: "finance", icon: "💰", name: "Finance", desc: "Save money", targetLabel: "Savings target (€)", targetPlaceholder: "e.g. 2000" },
  { type: "weight", icon: "⚖️", name: "Weight", desc: "Body goal", targetLabel: "Target weight (kg)", targetPlaceholder: "e.g. 70" },
  { type: "habits", icon: "🔁", name: "Habits", desc: "Build a streak", targetLabel: "Target days", targetPlaceholder: "e.g. 30" },
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
  });
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [milestones, setMilestones] = useState<string[]>(initialData?.milestones || []);
  const [milestoneInput, setMilestoneInput] = useState("");
  const [guideType, setGuideType] = useState<string | null>(null);
  const [guideTarget, setGuideTarget] = useState("");
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
      const goal = await res.json();
      router.push(`/goals/${goal.id}`);
    }
  }

  const estimatedXP = calcXP(form.priority, milestones.length, !!form.description.trim(), !!form.targetDate);

  const inputClass = "w-full px-4 py-3 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 text-[#ede9ff] placeholder-[#4a3a7a]";
  const selectedGuide = GUIDE_OPTIONS.find((g) => g.type === guideType);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-950/50 text-red-400 text-sm rounded-xl px-4 py-3 border border-red-800/50">{error}</div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#c4b5fd] mb-1">Title *</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What do you want to achieve?"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#c4b5fd] mb-1">Description</label>
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Describe your quest..."
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[#c4b5fd] mb-1">Difficulty</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className={inputClass}
          >
            <option value="low">🍃 Low</option>
            <option value="medium">⚡ Medium</option>
            <option value="high">🔥 High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#c4b5fd] mb-1">🌙 Deadline</label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#c4b5fd] mb-2">Category</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, categoryId: "" })}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              form.categoryId === ""
                ? "bg-[#ede9ff] text-[#0c0a1a] border-[#ede9ff]"
                : "bg-[#16112e] border-[#3b2d6e] text-[#9d8ac7]"
            }`}
          >
            None
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setForm({ ...form, categoryId: c.id })}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                form.categoryId === c.id ? "text-black" : "bg-[#16112e] text-[#9d8ac7]"
              }`}
              style={
                form.categoryId === c.id
                  ? { backgroundColor: c.color, borderColor: c.color }
                  : { borderColor: "#3b2d6e" }
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#c4b5fd] mb-1">Tags</label>
        <div className="flex gap-2 mb-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Add tag..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-[#ede9ff] placeholder-[#4a3a7a] text-sm"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-4 py-2.5 bg-[#1e1740] text-[#c4b5fd] rounded-xl text-sm font-medium border border-[#3b2d6e] hover:border-amber-500/40"
          >
            +
          </button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 text-xs bg-[#1e1740] text-[#9d8ac7] px-3 py-1 rounded-full border border-[#3b2d6e]">
                #{t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-0.5 text-[#6b5a9e] hover:text-red-400">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {!isEditing && (
        <div>
          <label className="block text-sm font-medium text-[#c4b5fd] mb-1">⭐ Milestones / Sub-goals</label>
          <div className="flex gap-2 mb-2">
            <input
              value={milestoneInput}
              onChange={(e) => setMilestoneInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMilestone(); } }}
              placeholder="Add a milestone..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-[#ede9ff] placeholder-[#4a3a7a] text-sm"
            />
            <button
              type="button"
              onClick={addMilestone}
              className="px-4 py-2.5 bg-[#1e1740] text-[#c4b5fd] rounded-xl text-sm font-medium border border-[#3b2d6e] hover:border-amber-500/40"
            >
              +
            </button>
          </div>
          {milestones.length > 0 && (
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-[#0f0d22] border border-[#2a1f50] rounded-xl px-4 py-2.5 text-sm text-[#ede9ff]">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-900/40 text-amber-400 text-xs flex items-center justify-center font-semibold border border-amber-700/40">
                      {i + 1}
                    </span>
                    {m}
                  </span>
                  <button type="button" onClick={() => setMilestones(milestones.filter((_, j) => j !== i))} className="text-[#6b5a9e] hover:text-red-400">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isEditing && (
        <div>
          <label className="block text-sm font-medium text-[#c4b5fd] mb-1">🧭 Guide</label>
          <p className="text-xs text-[#6b5a9e] mb-3">Pick a tracker to help you reach this quest automatically.</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {GUIDE_OPTIONS.map((g) => (
              <button
                key={String(g.type)}
                type="button"
                onClick={() => { setGuideType(g.type); setGuideTarget(""); }}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  guideType === g.type
                    ? "border-amber-500/60 bg-amber-900/20"
                    : "border-[#3b2d6e] bg-[#16112e] hover:border-[#4a3a7a]"
                }`}
              >
                <div className="text-xl mb-1">{g.icon}</div>
                <div className="text-sm font-medium text-[#ede9ff]">{g.name}</div>
                <div className="text-xs text-[#6b5a9e]">{g.desc}</div>
              </button>
            ))}
          </div>

          {guideType && selectedGuide?.targetLabel && (
            <div>
              <label className="block text-sm font-medium text-[#c4b5fd] mb-1">
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
              />
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
          className="flex-1 py-3 border border-[#3b2d6e] text-[#9d8ac7] rounded-xl font-semibold hover:bg-[#1e1740] transition-colors"
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
