import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function VitaPage() {
  await auth();

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-amber-400">🌿 Life</h1>
        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Your personal trackers</p>
      </div>

      <Link
        href="/peso"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">⚖️</span>
        <div>
          <p className="text-white font-semibold">Weight</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Track your measurements and progress</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>

      <Link
        href="/diet"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">🥗</span>
        <div>
          <p className="text-white font-semibold">Diet</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Daily meals, weight log and nutrition plan</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>

      <Link
        href="/routine"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">🔁</span>
        <div>
          <p className="text-white font-semibold">Habits</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Daily check-ins and weekly streaks</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>
    </div>
  );
}
