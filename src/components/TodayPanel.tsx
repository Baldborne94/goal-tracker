"use client";

import { useState } from "react";

// Il pannello «Oggi»: check-in delle missioni e sfide giornaliere in
// un'unica lista. Prima erano due sezioni separate che si somigliavano
// troppo — due titoli, due stili di riga, stessa domanda: "cosa mi frutta
// XP oggi?". La risposta merita un posto solo.

export type Challenge = {
  id: string;
  title: string;
  description: string;
  xp: number;
  type: string;
  completed: boolean;
  conditionMet: boolean;
};

export type CheckInItem = {
  id: string;
  title: string;
  xp: number;
  done: boolean;
};

const TYPE_ICONS: Record<string, string> = {
  complete_milestone:    "⚔️",
  complete_3_milestones: "🔥",
  complete_quest:        "👑",
  log_expense:           "💰",
  daily_checkin:         "📅",
  log_weight:            "⚖️",
  log_gym:               "🏋️",
  complete_meals:        "🥗",
  check_shopping:        "🛒",
};

export default function TodayPanel({
  checkIns,
  initialChallenges,
}: {
  checkIns: CheckInItem[];
  initialChallenges: Challenge[];
}) {
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

  const total = checkIns.length + challenges.length;
  if (total === 0) return null;

  const doneCount = checkIns.filter(c => c.done).length + challenges.filter(c => c.completed).length;
  const allDone = doneCount === total;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">⚡ Oggi</h2>
        <span className="text-xs text-amber-400">{doneCount}/{total}</span>
      </div>

      {allDone ? (
        // La giornata piena non sparisce: si vede che è stata vinta.
        <div
          className="rounded-2xl border p-4 text-center text-sm"
          style={{ background: "var(--theme-surface)", borderColor: "rgba(146,64,14,0.4)", color: "var(--theme-text-muted)" }}
        >
          ✨ Tutto fatto per oggi, eroe. Torna domani.
        </div>
      ) : (
        <div className="space-y-2">
          {checkIns.map((g) => (
            <a
              key={g.id}
              href={`/goals/${g.id}`}
              className="flex items-center gap-3 rounded-2xl border p-3 transition-colors"
              style={{ background: "var(--theme-surface)", borderColor: g.done ? "rgba(146,64,14,0.4)" : "var(--theme-surface-border)" }}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold border-2 transition-colors ${
                  g.done ? "bg-amber-500 border-amber-500 text-black" : "border-[#3b2d6e] text-transparent"
                }`}
              >
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${g.done ? "line-through" : "text-[#ede9ff]"}`} style={g.done ? { color: "var(--theme-text-muted)" } : {}}>
                  {g.title}
                </p>
                <p className="text-[11px]" style={{ color: "var(--theme-text-muted)" }}>Check-in della missione</p>
              </div>
              {!g.done && <span className="text-xs font-bold text-amber-400 flex-shrink-0">+{g.xp} XP</span>}
            </a>
          ))}

          {challenges.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border p-3"
              style={{ background: "var(--theme-surface)", borderColor: c.completed ? "rgba(146,64,14,0.4)" : "var(--theme-surface-border)" }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-base">
                {TYPE_ICONS[c.type] ?? "⚡"}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${c.completed ? "line-through" : "text-[#ede9ff]"}`} style={c.completed ? { color: "var(--theme-text-muted)" } : {}}>
                  {c.title}
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--theme-text-muted)" }}>{c.description}</p>
              </div>
              {claimedXp?.id === c.id ? (
                <span className="text-xs font-bold text-green-400 flex-shrink-0">+{claimedXp.xp} XP!</span>
              ) : c.completed ? (
                <span className="text-xs flex-shrink-0" style={{ color: "var(--theme-text-muted)" }}>✓ fatta</span>
              ) : c.conditionMet ? (
                <button
                  onClick={() => claim(c.id)}
                  disabled={claiming === c.id}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg flex-shrink-0 active:scale-95 transition-transform disabled:opacity-50"
                  style={{ background: "var(--theme-accent)", color: "#0b0b13" }}
                >
                  {claiming === c.id ? "…" : `Riscuoti +${c.xp}`}
                </button>
              ) : (
                <span className="text-xs font-bold text-amber-400/60 flex-shrink-0">+{c.xp} XP</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
