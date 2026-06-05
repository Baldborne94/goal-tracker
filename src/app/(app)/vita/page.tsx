import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function VitaPage() {
  await auth();

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-amber-400">🌿 Vita</h1>
        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>I tuoi tracker personali</p>
      </div>

      <Link
        href="/peso"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">⚖️</span>
        <div>
          <p className="text-white font-semibold">Peso</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Misura e monitora il tuo progresso</p>
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
          <p className="text-white font-semibold">Dieta</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Pasti giornalieri e tracciamento nutrizione</p>
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
          <p className="text-white font-semibold">Abitudini</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Check-in giornalieri e serie settimanali</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>

      <Link
        href="/workout"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">🏋️</span>
        <div>
          <p className="text-white font-semibold">Allenamento</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Esercizi, kcal bruciate e storico sessioni</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>

      <Link
        href="/sleep"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">💤</span>
        <div>
          <p className="text-white font-semibold">Sonno</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Ore di riposo e qualità del sonno</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>
    </div>
  );
}
