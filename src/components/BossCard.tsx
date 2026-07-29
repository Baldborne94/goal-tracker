"use client";

import { useState } from "react";
import { formatBossValue, type BossProgress } from "@/lib/boss";

// Il Boss della settimana nel Reame. Tre condizioni, una barra sola, e un
// pulsante che compare solo quando l'impresa è compiuta: il boss non si
// batte a metà.

export default function BossCard({ initial }: { initial: BossProgress }) {
  const [progress, setProgress] = useState(initial);
  const [claiming, setClaiming] = useState(false);
  const [justWon, setJustWon] = useState<number | null>(null);

  async function claim() {
    setClaiming(true);
    try {
      const res = await fetch("/api/boss", { method: "POST" });
      if (res.ok) {
        const { xp } = await res.json();
        setJustWon(xp);
        setProgress((p) => ({ ...p, claimed: true }));
      }
    } finally {
      setClaiming(false);
    }
  }

  const { boss, conditions, percent, defeated, claimed } = progress;

  return (
    <div
      className="rounded-2xl border p-4 mb-6 relative overflow-hidden"
      style={{
        background: "var(--theme-surface)",
        borderColor: defeated && !claimed ? "var(--theme-accent)" : "var(--theme-surface-border)",
      }}
    >
      {/* Alone dietro l'icona: il boss deve pesare più di una sfida qualsiasi */}
      <div
        className="absolute -top-8 -right-8 w-32 h-32 opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, var(--theme-accent) 0%, transparent 70%)" }}
      />

      <div className="flex items-start gap-3 mb-3">
        <span className="text-4xl flex-none">{boss.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--theme-text-muted)" }}>
            Boss della settimana
          </p>
          <p className="text-lg font-bold text-[#ede9ff] leading-tight">{boss.name}</p>
          <p className="text-[11px] leading-snug mt-0.5" style={{ color: "var(--theme-text-muted)" }}>
            {claimed ? "Abbattuto. Torna lunedì per il prossimo." : boss.taunt}
          </p>
        </div>
      </div>

      <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "rgba(120,120,140,0.25)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, background: "var(--theme-bar)" }}
        />
      </div>

      <div className="space-y-1.5">
        {conditions.map(({ condition, current, done }) => (
          <div key={condition.metric} className="flex items-center gap-2 text-xs">
            <span className="flex-none w-4 text-center" style={{ color: done ? "var(--theme-accent)" : "var(--theme-text-muted)" }}>
              {done ? "✓" : "○"}
            </span>
            <span className="flex-1 truncate" style={{ color: done ? "var(--theme-text-muted)" : "#ede9ff" }}>
              {condition.label}
            </span>
            <span className="flex-none tabular-nums font-semibold" style={{ color: done ? "var(--theme-accent)" : "var(--theme-text-muted)" }}>
              {formatBossValue(condition.metric, current)}/{formatBossValue(condition.metric, condition.target)}
            </span>
          </div>
        ))}
      </div>

      {justWon !== null ? (
        <p className="mt-3 text-center text-sm font-bold" style={{ color: "#4ade80" }}>
          🏆 {boss.name} abbattuto · +{justWon} XP
        </p>
      ) : claimed ? (
        <p className="mt-3 text-center text-xs" style={{ color: "var(--theme-text-muted)" }}>
          🏆 Vittoria riscossa
        </p>
      ) : defeated ? (
        <button
          onClick={claim}
          disabled={claiming}
          className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
          style={{ background: "var(--theme-accent)", color: "#0b0b13" }}
        >
          {claiming ? "…" : `Riscuoti la vittoria · +${boss.xp} XP`}
        </button>
      ) : (
        <p className="mt-3 text-center text-[11px]" style={{ color: "var(--theme-text-muted)" }}>
          Ricompensa: {boss.xp} XP ·{" "}
          {boss.stats.map((s) => `+${s.points} ${s.stat.toUpperCase()}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
