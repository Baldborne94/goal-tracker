"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "🏰", label: "Reame" },
  { href: "/goals", icon: "⚔️", label: "Missioni" },
  { href: "/kakeebo", icon: "📒", label: "Oro" },
  { href: "/vita", icon: "🌿", label: "Vita" },
  { href: "/profile", icon: "🧙", label: "Eroe" },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0f0d22] border-t border-[#3b2d6e] safe-area-pb z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {NAV_ITEMS.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all",
                active ? "text-amber-400" : "text-[#6b5a9e]"
              )}
            >
              <span className={cn("text-2xl transition-transform", active && "scale-110")}>{item.icon}</span>
              <span className={cn("text-xs font-medium", active ? "text-amber-400" : "text-[#6b5a9e]")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
