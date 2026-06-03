"use client";

import Link from "next/link";

const FEATURES = [
  { icon: "⚔️", label: "Quests",    desc: "Set goals & earn XP" },
  { icon: "💎", label: "Treasury",  desc: "Track spending" },
  { icon: "📅", label: "Check-ins", desc: "Build habits daily" },
];

const STEPS = [
  { n: 1, title: "Create a quest",         desc: "Set a goal with milestones and a deadline." },
  { n: 2, title: "Complete milestones",     desc: "Each one earns XP and levels up your hero." },
  { n: 3, title: "Build streaks",           desc: "Come back every day to keep the fire burning." },
];

const QUICK_STARTS = [
  { icon: "🏋️", title: "Go to the gym 3×/week for a month",    href: "/goals/new?title=Go+to+the+gym+3+times+a+week+for+a+month&days=30&mtype=sessions&spw=3" },
  { icon: "📚", title: "Read 1 hour every day for 30 days",     href: "/goals/new?title=Read+at+least+1+hour+every+day+for+30+days&days=30&mtype=daily" },
  { icon: "💧", title: "Drink 2L of water daily for 21 days",   href: "/goals/new?title=Drink+2L+of+water+every+day+for+21+days&days=21&mtype=daily" },
  { icon: "🧘", title: "Morning stretch every day for 21 days", href: "/goals/new?title=Morning+stretch+routine+every+day+for+21+days&days=21&mtype=daily" },
];

export default function OnboardingScreen({ name }: { name?: string | null }) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-2 pb-8">

      {/* Hero */}
      <div className="text-center mb-8">
        <div className="text-7xl mb-4 animate-bounce" style={{ animationDuration: "2s" }}>⚔️</div>
        <h2 className="text-2xl font-bold text-[#ede9ff] mb-2">
          Welcome{name ? `, ${name}` : ""}!
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
          This is your realm. Complete quests, earn XP, level up from<br />
          🗡️ Recruit all the way to ✨ Divine.
        </p>
      </div>

      {/* Feature pills */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {FEATURES.map((f) => (
          <div
            key={f.label}
            className="rounded-2xl border p-3 text-center"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            <div className="text-2xl mb-1">{f.icon}</div>
            <p className="text-xs font-bold text-[#ede9ff]">{f.label}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--theme-text-muted)" }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div
        className="rounded-2xl border p-5 mb-6"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--theme-text-muted)" }}>
          How it works
        </p>
        <div className="space-y-4">
          {STEPS.map((s) => (
            <div key={s.n} className="flex items-start gap-3">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{ background: "linear-gradient(135deg, #f59e0b, #eab308)", color: "#000" }}
              >
                {s.n}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#ede9ff]">{s.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--theme-text-muted)" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main CTA */}
      <Link
        href="/goals/new"
        className="block w-full py-4 rounded-2xl font-bold text-center text-base shadow-lg shadow-amber-900/30 active:scale-95 transition-all mb-4"
        style={{ background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }}
      >
        ⚔️ Create your first quest
      </Link>

      {/* Quick-start suggestions */}
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--theme-text-muted)" }}>
        💡 Or pick a quick start
      </p>
      <div className="space-y-2">
        {QUICK_STARTS.map((q) => (
          <Link
            key={q.title}
            href={q.href}
            className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors hover:border-amber-500/30 active:scale-95"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            <span className="text-xl flex-shrink-0">{q.icon}</span>
            <span className="text-sm text-[#ede9ff] flex-1">{q.title}</span>
            <span className="text-amber-400 text-lg flex-shrink-0">+</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
