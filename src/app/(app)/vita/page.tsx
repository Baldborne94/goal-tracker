import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function VitaPage() {
  await auth();

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-amber-400">🌿 Life</h1>
        <p className="text-xs text-[#6b5a9e]">Your personal trackers</p>
      </div>

      <Link
        href="/peso"
        className="flex items-center gap-4 bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-5 active:scale-95 transition-transform"
      >
        <span className="text-4xl">⚖️</span>
        <div>
          <p className="text-white font-semibold">Weight</p>
          <p className="text-xs text-[#6b5a9e]">Track your measurements and progress</p>
        </div>
        <span className="ml-auto text-[#6b5a9e] text-lg">›</span>
      </Link>

      <Link
        href="/routine"
        className="flex items-center gap-4 bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-5 active:scale-95 transition-transform"
      >
        <span className="text-4xl">🔁</span>
        <div>
          <p className="text-white font-semibold">Habits</p>
          <p className="text-xs text-[#6b5a9e]">Daily check-ins and weekly streaks</p>
        </div>
        <span className="ml-auto text-[#6b5a9e] text-lg">›</span>
      </Link>
    </div>
  );
}
