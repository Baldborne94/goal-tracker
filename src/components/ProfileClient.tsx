"use client";

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
  { level: 1, label: "Principiante", min: 0, max: 49 },
  { level: 2, label: "Apprendista", min: 50, max: 149 },
  { level: 3, label: "Esperto", min: 150, max: 349 },
  { level: 4, label: "Maestro", min: 350, max: 699 },
  { level: 5, label: "Leggenda", min: 700, max: Infinity },
];

function getLevel(points: number) {
  return LEVEL_THRESHOLDS.find((l) => points >= l.min && points <= l.max) || LEVEL_THRESHOLDS[0];
}

export default function ProfileClient({ user, stats }: { user: User | null; stats: Stats }) {
  if (!user) return null;

  const level = getLevel(user.points);
  const nextLevel = LEVEL_THRESHOLDS.find((l) => l.level === level.level + 1);
  const progressToNext = nextLevel
    ? Math.round(((user.points - level.min) / (nextLevel.min - level.min)) * 100)
    : 100;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Profilo</h1>

      {/* User card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl font-bold">
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-indigo-200 text-sm">{user.email}</p>
            <p className="text-indigo-100 text-sm font-medium mt-0.5">
              Liv. {level.level} — {level.label}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-indigo-200">XP: {user.points}</span>
            {nextLevel && (
              <span className="text-indigo-200">Prossimo livello: {nextLevel.min} pts</span>
            )}
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Totali", value: stats.total, emoji: "📋" },
          { label: "Attivi", value: stats.active, emoji: "🎯" },
          { label: "Completati", value: stats.completed, emoji: "✅" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 text-center shadow-sm">
            <div className="text-2xl mb-1">{s.emoji}</div>
            <div className="text-2xl font-bold text-slate-800">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Rewards */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-3">
          Premi ottenuti{" "}
          <span className="text-slate-400 font-normal">({user.userRewards.length})</span>
        </h2>

        {user.userRewards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
            <div className="text-3xl mb-2">🏆</div>
            <p className="text-slate-500 text-sm">Completa obiettivi per sbloccare premi</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {user.userRewards.map((ur) => (
              <div
                key={ur.id}
                className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
              >
                <div className="text-3xl mb-2">{ur.reward.icon}</div>
                <div className="font-semibold text-slate-800 text-sm">{ur.reward.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{ur.reward.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full py-3 border border-red-200 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition-colors"
      >
        Esci dall&apos;account
      </button>
    </div>
  );
}
