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

      <div
        className="rounded-2xl border px-4 py-3 text-xs leading-relaxed"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
      >
        💡 <span className="font-semibold" style={{ color: "var(--theme-text)" }}>Da dove iniziare:</span> registra il peso e logga i pasti del giorno — sbloccano le sfide giornaliere e popolano le statistiche dell&apos;Eroe.
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
        href="/palestra"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">🏋️</span>
        <div>
          <p className="text-white font-semibold">Programma Palestra</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Push · Pull · Gambe · Addome+Cardio</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>

      <Link
        href="/nutrizionista"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">🥗</span>
        <div>
          <p className="text-white font-semibold">Nutrizionista</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Piano pasti mensile · Dott.ssa Michela Audiello</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>

      <Link
        href="/spesa"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">🛒</span>
        <div>
          <p className="text-white font-semibold">Lista della Spesa</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Aggiungi prodotti e spunta quelli acquistati</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>

      <Link
        href="/svuota-frigo"
        className="flex items-center gap-4 border rounded-2xl p-5 active:scale-95 transition-transform"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <span className="text-4xl">🧊</span>
        <div>
          <p className="text-white font-semibold">Svuota Frigo</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Inserisci gli ingredienti e scopri cosa cucinare</p>
        </div>
        <span className="ml-auto text-lg" style={{ color: "var(--theme-text-muted)" }}>›</span>
      </Link>
    </div>
  );
}
