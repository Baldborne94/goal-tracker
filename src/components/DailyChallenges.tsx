"use client";

import { useState } from "react";

export type Challenge = {
  id: string;
  title: string;
  description: string;
  xp: number;
  type: string;
  completed: boolean;
  conditionMet: boolean;
};

const TYPE_ICONS: Record<string, string> = {
  complete_milestone:    "⚔️",
  log_expense:           "💰",
  daily_checkin:         "📅",
  complete_3_milestones: "🔥",
  complete_quest:        "👑",
};

export default function DailyChallenges({ initialChallenges }: { initialChallenges: Challenge[] }) {
  const [challenges, setChallenges] = useState<Challenge[]>(initialChallenges);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimedXp, setClaimedXp] = useState<{ id: string; xp: number } | null>(null);

  async function claim(id: string) {
    setClaiming(id);
    try {
      const r = await fetch(`/api/challenges/${id}/claim`, { method: "POST" });
      if (r.ok) {
        const { xp } = await r.json();
        setChallenges(prev => prev.map(c => c.id === id ? { ...c, completed: true } : c));
        setClaimedXp({ id, xp });
        setTimeout(() => setClaimedXp(null), 2500);
      }
    } finally {
      setClaiming(null);
    }
  }

  if (challenges.length === 0) return null;
  if (challenges.every(c => c.completed)) return null;

  const completedCount = challenges.filter(c => c.completed).length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">⚡ Daily Challenges</h2>
        <span className="text-xs text-amber-400">{completedCount}/{challenges.length} done</span>
      </div>
      <div className="space-y-2">
        {challenges.map(c => (
          <div
            key={c.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition-all ${c.completed ? "opacity-50" : ""}`}
            style={{ background: "var(--theme-surface)", borderColor: c.conditionMet && !c.completed ? "rgba(245,158,11,0.4)" : "var(--theme-surface-border)" }}
          >
            <span className="text-xl flex-shrink-0">{TYPE_ICONS[c.type] ?? "🎯"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#ede9ff] truncate">{c.title}</p>
              <p className="text-xs truncate" style={{ color: "var(--theme-text-muted)" }}>{c.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-bold text-amber-400">+{c.xp} XP</span>
              {c.completed ? (
                <span className="text-xs text-green-400">✓</span>
              ) : (
                <button
                  onClick={() => claim(c.id)}
                  disabled={!c.conditionMet || claiming === c.id}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
                  style={c.conditionMet
                    ? { background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }
                    : { background: "var(--theme-bg)", color: "var(--theme-text-muted)", border: "1px solid var(--theme-surface-border)" }
                  }
                >
                  {claiming === c.id ? "..." : c.conditionMet ? "Claim" : "Locked"}
                </button>
              )}
            </div>
            {claimedXp?.id === c.id && (
              <span className="absolute text-xs font-bold text-amber-300 animate-bounce">+{claimedXp.xp} XP!</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
