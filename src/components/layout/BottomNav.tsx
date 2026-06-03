"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getLevel } from "@/lib/levels";

export default function BottomNav({ points = 0, heroClass }: { points?: number; heroClass?: string | null }) {
  const path = usePathname();
  const tier = getLevel(points, heroClass);

  const NAV_ITEMS = [
    { href: "/dashboard", icon: "🏰", label: "Realm" },
    { href: "/goals",     icon: "📜", label: "Quests" },
    { href: "/finance",   icon: "💎", label: "Treasury" },
    { href: "/vita",      icon: "⚗️", label: "Alchemy" },
    { href: "/profile",   icon: tier.icon, label: "Hero" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t safe-area-pb z-50" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {NAV_ITEMS.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all"
              style={{ color: active ? "var(--theme-accent)" : "var(--theme-text-muted)" }}
            >
              <span className={cn("text-2xl transition-transform", active && "scale-110")}>{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
