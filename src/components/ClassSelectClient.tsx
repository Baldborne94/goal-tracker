"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { CLASSES, CLASS_GROUPS, type HeroClass } from "@/lib/classes";
import { updateHeroClass, updateTheme } from "@/app/(app)/profile/actions";

export default function ClassSelectClient() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [selected, setSelected] = useState<HeroClass | null>(null);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    if (!selected) return;
    setLoading(true);
    try {
      const cls = CLASSES.find((c) => c.key === selected)!;
      // Save class + recommended theme to DB
      await updateHeroClass(selected);
      await updateTheme(cls.theme);
      // Update theme in client immediately
      setTheme(cls.theme);
      localStorage.setItem("hero-theme", cls.theme);
    } catch { /* ignore */ }
    router.push("/tutorial");
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">⚔️</div>
        <h1 className="text-2xl font-bold text-[#ede9ff] mb-1">Choose your class</h1>
        <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
          This shapes your hero&apos;s path, level titles and visual theme.
        </p>
      </div>

      {/* Groups */}
      <div className="space-y-6 mb-8">
        {CLASS_GROUPS.map((group) => {
          const groupClasses = CLASSES.filter((c) => c.group === group.key);
          return (
            <div key={group.key}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--theme-text-muted)" }}>
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {groupClasses.map((cls) => {
                  const isSelected = selected === cls.key;
                  return (
                    <button
                      key={cls.key}
                      onClick={() => setSelected(cls.key)}
                      className="rounded-2xl border p-3 text-center transition-all active:scale-95"
                      style={{
                        background: isSelected ? group.color + "18" : "var(--theme-surface)",
                        borderColor: isSelected ? group.color : "var(--theme-surface-border)",
                        boxShadow: isSelected ? `0 0 0 1px ${group.color}` : "none",
                      }}
                    >
                      <div className="text-2xl mb-1">{cls.icon}</div>
                      <p className="text-xs font-bold text-[#ede9ff] leading-tight">{cls.name}</p>
                      <p className="text-xs mt-0.5 leading-tight" style={{ color: "var(--theme-text-muted)" }}>
                        {cls.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected preview */}
      {selected && (() => {
        const cls = CLASSES.find((c) => c.key === selected)!;
        return (
          <div
            className="rounded-2xl border p-4 mb-6"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{cls.icon}</span>
              <div>
                <p className="font-bold text-[#ede9ff]">{cls.name}</p>
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{cls.description}</p>
              </div>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--theme-text-muted)" }}>
              Level path
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cls.tiers.map((t, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-0.5 rounded-full border"
                  style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                >
                  {t.icon} {t.label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* CTA */}
      <button
        onClick={confirm}
        disabled={!selected || loading}
        className="block w-full py-4 rounded-2xl font-bold text-center text-base shadow-lg shadow-amber-900/30 active:scale-95 transition-all disabled:opacity-40"
        style={{ background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }}
      >
        {loading ? "Saving…" : selected ? `Begin as ${CLASSES.find(c => c.key === selected)?.name} →` : "Select a class to continue"}
      </button>
    </div>
  );
}
