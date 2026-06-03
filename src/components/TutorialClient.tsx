"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markOnboardingComplete } from "@/app/(app)/profile/actions";

const SECTIONS = [
  {
    icon: "⚔️",
    title: "Quests & Milestones",
    color: "#f59e0b",
    steps: [
      "Create a quest with a title, deadline, category and priority",
      "Break it into milestones — each one is a concrete step forward",
      "Complete milestones to earn XP and move the progress bar",
      "When all milestones are done, mark the quest complete",
    ],
    tip: "💡 No milestones? Enable daily check-in instead and track progress day by day.",
  },
  {
    icon: "✨",
    title: "XP & Levels",
    color: "#a78bfa",
    steps: [
      "Every completed milestone earns XP (default: 10 XP each)",
      "XP accumulates and levels up your hero automatically",
      "8 tiers: Recruit → Warrior → Knight → Warlord → King → Emperor → Legend → Divine",
      "Your current level icon appears in the navigation bar",
    ],
    tip: "💡 Your level icon in the nav bar changes as you level up — watch for it!",
  },
  {
    icon: "📅",
    title: "Daily Check-ins & Streaks",
    color: "#34d399",
    steps: [
      "Enable daily check-in on any quest from the quest settings",
      "Come back every day and tap Check In to earn XP",
      "You can restrict check-ins to specific days of the week",
      "Consecutive check-in days build a streak shown on the dashboard",
    ],
    tip: "💡 Streaks reset if you miss a scheduled day — consistency is the key!",
  },
  {
    icon: "💎",
    title: "Treasury",
    color: "#38bdf8",
    steps: [
      "Set a monthly budget in the Treasury section",
      "Log expenses by category (food, transport, subscriptions…)",
      "The donut chart and trend graph show where your money goes",
      "Close the month under budget to earn a bonus 25 XP + trophy",
    ],
    tip: "💡 You can import bank statements directly from ISYbank Excel exports.",
  },
  {
    icon: "⚡",
    title: "Daily Challenges",
    color: "#fb923c",
    steps: [
      "Five bonus challenges are available every day",
      "Conditions: complete milestones, log expenses, do check-ins…",
      "When the condition is met, the Claim button lights up",
      "Claim your XP before midnight — challenges reset daily",
    ],
    tip: "💡 All 5 done? You're having a great day — keep the momentum!",
  },
];

const LEVEL_TIERS = [
  { icon: "🗡️", label: "Recruit",  xp: "0" },
  { icon: "⚔️", label: "Warrior",  xp: "200" },
  { icon: "🛡️", label: "Knight",   xp: "600" },
  { icon: "🏰", label: "Warlord",  xp: "1 500" },
  { icon: "👑", label: "King",     xp: "3 000" },
  { icon: "⚜️", label: "Emperor", xp: "6 000" },
  { icon: "🔱", label: "Legend",   xp: "10 000" },
  { icon: "✨", label: "Divine",   xp: "20 000" },
];

export default function TutorialClient({
  name,
  isFirstTime,
}: {
  name?: string | null;
  isFirstTime: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      await markOnboardingComplete();
    } catch {
      // ignore — still navigate
    }
    router.push("/dashboard");
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-10">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3 animate-bounce" style={{ animationDuration: "2s" }}>📖</div>
        <h1 className="text-2xl font-bold text-[#ede9ff] mb-1">
          {isFirstTime && name ? `Welcome, ${name}!` : "How to play"}
        </h1>
        <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
          Everything you need to know to master your quests.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4 mb-8">
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border p-5"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: s.color + "22", border: `1px solid ${s.color}44` }}
              >
                {s.icon}
              </span>
              <h2 className="text-base font-bold text-[#ede9ff]">{s.title}</h2>
            </div>

            {/* Steps */}
            <div className="space-y-2.5 mb-3">
              {s.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: s.color + "33", color: s.color }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#c4b5fd]">{step}</p>
                </div>
              ))}
            </div>

            {/* Tip */}
            <p
              className="text-xs rounded-xl px-3 py-2"
              style={{ background: "var(--theme-bg)", color: "var(--theme-text-muted)" }}
            >
              {s.tip}
            </p>
          </div>
        ))}
      </div>

      {/* Level tiers reference */}
      <div
        className="rounded-2xl border p-5 mb-8"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--theme-text-muted)" }}>
          🏅 Level tiers
        </p>
        <div className="grid grid-cols-4 gap-2">
          {LEVEL_TIERS.map((t) => (
            <div key={t.label} className="text-center">
              <div className="text-xl mb-0.5">{t.icon}</div>
              <p className="text-xs font-semibold text-[#ede9ff]">{t.label}</p>
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{t.xp} XP</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {isFirstTime ? (
        <>
          <button
            onClick={handleStart}
            disabled={loading}
            className="block w-full py-4 rounded-2xl font-bold text-center text-base shadow-lg shadow-amber-900/30 active:scale-95 transition-all mb-3 disabled:opacity-60"
            style={{ background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }}
          >
            {loading ? "Loading…" : "⚔️ Start my adventure"}
          </button>
          <p className="text-center text-xs" style={{ color: "var(--theme-text-muted)" }}>
            You can always re-read this guide via the{" "}
            <span className="font-bold text-[#ede9ff]">?</span> button on the dashboard.
          </p>
        </>
      ) : (
        <Link
          href="/dashboard"
          className="block w-full py-4 rounded-2xl font-bold text-center text-base border active:scale-95 transition-all"
          style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}
        >
          ← Back to dashboard
        </Link>
      )}
    </div>
  );
}
