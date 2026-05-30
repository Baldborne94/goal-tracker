"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

type Reward = { id: string; name: string; description: string; icon: string; type: string };
type UserReward = { id: string; reward: Reward; earnedAt: string };

type User = {
  id: string;
  name: string | null;
  email: string;
  points: number;
  userRewards: UserReward[];
};

type Stats = { total: number; completed: number; active: number };

const LEVEL_THRESHOLDS = [
  { level: 1, label: "Recruit",   icon: "🗡️",  min: 0,   max: 49 },
  { level: 2, label: "Warrior",   icon: "⚔️",  min: 50,  max: 149 },
  { level: 3, label: "Knight",    icon: "🛡️",  min: 150, max: 349 },
  { level: 4, label: "Warlord",   icon: "🏰",  min: 350, max: 699 },
  { level: 5, label: "King",      icon: "👑",  min: 700, max: Infinity },
];

function getLevel(points: number) {
  return LEVEL_THRESHOLDS.find((l) => points >= l.min && points <= l.max) || LEVEL_THRESHOLDS[0];
}

export default function ProfileClient({ user, stats, streak = 0 }: { user: User | null; stats: Stats; streak?: number }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmResetRewards, setConfirmResetRewards] = useState(false);
  const [resettingRewards, setResettingRewards] = useState(false);
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);
  const [wipingAll, setWipingAll] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);

  if (!user) return null;

  async function saveName() {
    if (!nameInput.trim()) return;
    setSavingName(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput.trim() }),
    });
    if (res.ok) {
      setDisplayName(nameInput.trim());
      setEditingName(false);
    }
    setSavingName(false);
  }

  const level = getLevel(user.points);
  const nextLevel = LEVEL_THRESHOLDS.find((l) => l.level === level.level + 1);
  const progressToNext = nextLevel
    ? Math.round(((user.points - level.min) / (nextLevel.min - level.min)) * 100)
    : 100;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#ede9ff] mb-6">⚔️ Hero Profile</h1>

      {/* Hero card */}
      <div className="rounded-2xl p-5 text-white mb-6 relative overflow-hidden" style={{background: "linear-gradient(135deg, #2d1b6e 0%, #1a0f3e 50%, #0f0826 100%)", border: "1px solid #4c3880"}}>
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10" style={{background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)"}}/>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold" style={{background: "linear-gradient(135deg, #3b2d6e, #1e1535)", border: "2px solid #f59e0b55"}}>
            {user.name?.[0]?.toUpperCase() || "⚔"}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="flex-1 bg-[#0f0826] border border-amber-500/40 rounded-lg px-2 py-1 text-[#ede9ff] text-sm font-bold focus:outline-none focus:ring-1 focus:ring-amber-500/60 min-w-0"
                />
                <button
                  onClick={saveName}
                  disabled={savingName}
                  className="text-amber-400 text-xs font-bold px-2 py-1 rounded bg-amber-900/30 border border-amber-700/40 disabled:opacity-50 flex-shrink-0"
                >
                  {savingName ? "..." : "✓"}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameInput(displayName); }}
                  className="text-[#6b5a9e] text-xs px-1 flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1.5 group mb-1"
              >
                <h2 className="text-xl font-bold text-[#ede9ff] truncate">{displayName}</h2>
                <span className="text-[#4a3a7a] group-hover:text-amber-400 text-xs transition-colors flex-shrink-0">✏️</span>
              </button>
            )}
            <p className="text-[#9d8ac7] text-sm">{user.email}</p>
            <p className="text-amber-400 text-sm font-semibold mt-0.5">
              {level.icon} Lv. {level.level} — {level.label}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-amber-300/80">✨ {user.points} XP</span>
            {nextLevel && (
              <span className="text-[#9d8ac7] text-xs">Next: {nextLevel.min} XP</span>
            )}
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{background: "#0f0826"}}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressToNext}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)" }}
            />
          </div>
          {nextLevel && (
            <p className="text-xs text-[#6b5a9e] mt-1">{progressToNext}% towards {nextLevel.label}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {[
          { label: "Total", value: stats.total, icon: "📜" },
          { label: "Active", value: stats.active, icon: "⚡" },
          { label: "Done", value: stats.completed, icon: "👑" },
          { label: "Streak", value: streak, icon: streak > 0 ? "🔥" : "💤" },
        ].map((s) => (
          <div key={s.label} className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-3 text-center">
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold text-amber-400">{s.value}</div>
            <div className="text-xs text-[#9d8ac7]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Rewards */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">
          💎 Trophies{" "}
          <span className="text-[#6b5a9e] font-normal">({user.userRewards.length})</span>
        </h2>

        {user.userRewards.length === 0 ? (
          <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-6 text-center">
            <div className="text-3xl mb-2">🏆</div>
            <p className="text-[#9d8ac7] text-sm">Complete quests to unlock trophies</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {user.userRewards.map((ur) => (
              <div
                key={ur.id}
                className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-4"
              >
                <div className="text-3xl mb-2">{ur.reward.icon}</div>
                <div className="font-semibold text-[#ede9ff] text-sm">{ur.reward.name}</div>
                <div className="text-xs text-[#9d8ac7] mt-0.5">{ur.reward.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-[#16112e] rounded-2xl border border-red-900/30 p-5 mb-4">
        <h2 className="text-sm font-semibold text-red-400/80 uppercase tracking-wider mb-4">⚠️ Danger zone</h2>

        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-2.5 border border-red-900/50 text-red-400 rounded-xl text-sm font-medium hover:bg-red-950/30 transition-colors"
          >
            Delete all quests
          </button>
        ) : (
          <div>
            <p className="text-sm text-[#c4b5fd] mb-3">
              This will permanently delete all your quests, milestones and guide data. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 border border-[#3b2d6e] text-[#9d8ac7] rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setResetting(true);
                  await fetch("/api/goals/all", { method: "DELETE" });
                  setResetting(false);
                  setConfirmReset(false);
                  window.location.reload();
                }}
                disabled={resetting}
                className="flex-1 py-2.5 bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
              >
                {resetting ? "Deleting..." : "Yes, delete all"}
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-red-900/20 my-4" />

        {!confirmResetRewards ? (
          <button
            onClick={() => setConfirmResetRewards(true)}
            className="w-full py-2.5 border border-red-900/50 text-red-400 rounded-xl text-sm font-medium hover:bg-red-950/30 transition-colors"
          >
            Reset trophies & XP
          </button>
        ) : (
          <div>
            <p className="text-sm text-[#c4b5fd] mb-3">
              This will delete all your trophies and reset your XP to 0. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmResetRewards(false)}
                className="flex-1 py-2.5 border border-[#3b2d6e] text-[#9d8ac7] rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setResettingRewards(true);
                  await fetch("/api/profile/reset-rewards", { method: "DELETE" });
                  setResettingRewards(false);
                  setConfirmResetRewards(false);
                  window.location.reload();
                }}
                disabled={resettingRewards}
                className="flex-1 py-2.5 bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
              >
                {resettingRewards ? "Resetting..." : "Yes, reset"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wipe everything */}
      <div className="bg-[#16112e] rounded-2xl border border-red-900/50 p-5 mb-4">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-1">💀 Wipe everything</h2>
        <p className="text-xs text-[#6b5a9e] mb-4">Delete all quests, trophies and reset XP to 0. A clean slate.</p>

        {!confirmWipeAll ? (
          <button
            onClick={() => setConfirmWipeAll(true)}
            className="w-full py-2.5 bg-red-950/40 border border-red-700/60 text-red-300 rounded-xl text-sm font-semibold hover:bg-red-900/40 transition-colors"
          >
            💀 Reset everything
          </button>
        ) : (
          <div>
            <p className="text-sm text-[#c4b5fd] mb-3">
              This will permanently delete ALL quests, trophies and reset XP to 0. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmWipeAll(false)}
                className="flex-1 py-2.5 border border-[#3b2d6e] text-[#9d8ac7] rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setWipingAll(true);
                  await fetch("/api/goals/all", { method: "DELETE" });
                  await fetch("/api/profile/reset-rewards", { method: "DELETE" });
                  setWipingAll(false);
                  setConfirmWipeAll(false);
                  window.location.reload();
                }}
                disabled={wipingAll}
                className="flex-1 py-2.5 bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
              >
                {wipingAll ? "Wiping..." : "Yes, wipe all"}
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full py-3 border border-red-900/50 text-red-400 rounded-xl font-semibold hover:bg-red-950/30 transition-colors"
      >
        Leave the realm
      </button>
    </div>
  );
}
