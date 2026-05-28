import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function VitaPage() {
  await auth();

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-amber-400">🌿 Vita</h1>
        <p className="text-xs text-[#6b5a9e]">I tuoi tracker personali</p>
      </div>

      <Link
        href="/peso"
        className="flex items-center gap-4 bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-5 active:scale-95 transition-transform"
      >
        <span className="text-4xl">⚖️</span>
        <div>
          <p className="text-white font-semibold">Peso</p>
          <p className="text-xs text-[#6b5a9e]">Traccia le tue misurazioni e l&apos;andamento</p>
        </div>
        <span className="ml-auto text-[#6b5a9e] text-lg">›</span>
      </Link>

      <Link
        href="/routine"
        className="flex items-center gap-4 bg-[#16112e] border border-[#3b2d6e] rounded-2xl p-5 active:scale-95 transition-transform"
      >
        <span className="text-4xl">🔁</span>
        <div>
          <p className="text-white font-semibold">Abitudini</p>
          <p className="text-xs text-[#6b5a9e]">Check giornaliero e streak settimanale</p>
        </div>
        <span className="ml-auto text-[#6b5a9e] text-lg">›</span>
      </Link>
    </div>
  );
}
