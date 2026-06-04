"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markOnboardingComplete } from "@/app/(app)/profile/actions";
import { getClassDef } from "@/lib/classes";

const SECTIONS = [
  {
    icon: "⚔️",
    title: "Missioni e Tappe",
    color: "#f59e0b",
    steps: [
      "Crea una missione con titolo, scadenza, categoria e priorità",
      "Dividila in tappe — ognuna è un passo concreto avanti",
      "Completa le tappe per guadagnare XP e avanzare la barra di progresso",
      "Quando tutte le tappe sono completate, segna la missione come conclusa",
    ],
    tip: "💡 Nessuna tappa? Abilita il check-in giornaliero e traccia i progressi giorno per giorno.",
  },
  {
    icon: "✨",
    title: "XP e Livelli",
    color: "#a78bfa",
    steps: [
      "Ogni tappa completata guadagna XP (predefinito: 10 XP ciascuna)",
      "Gli XP si accumulano e fanno salire di livello il tuo eroe automaticamente",
      "8 livelli: Recluta → Guerriero → Cavaliere → Condottiero → Re → Imperatore → Leggenda → Divino",
      "L'icona del tuo livello attuale appare nella barra di navigazione",
    ],
    tip: "💡 L'icona del livello nella barra cambia man mano che sali — tienila d'occhio!",
  },
  {
    icon: "📅",
    title: "Check-in Giornaliero e Serie",
    color: "#34d399",
    steps: [
      "Abilita il check-in giornaliero su qualsiasi missione dalle impostazioni",
      "Torna ogni giorno e premi Check In per guadagnare XP",
      "Puoi limitare i check-in a giorni specifici della settimana",
      "I giorni consecutivi di check-in formano una serie mostrata nella bacheca",
    ],
    tip: "💡 La serie si azzera se salti un giorno pianificato — la costanza è la chiave!",
  },
  {
    icon: "💎",
    title: "Tesoro",
    color: "#38bdf8",
    steps: [
      "Imposta un budget mensile nella sezione Tesoro",
      "Registra le spese per categoria (cibo, trasporti, abbonamenti…)",
      "Il grafico a ciambella e il trend mostrano dove vanno i tuoi soldi",
      "Chiudi il mese sotto budget per guadagnare 25 XP bonus + trofeo",
    ],
    tip: "💡 Puoi importare gli estratti conto direttamente dai file Excel di ISYbank.",
  },
  {
    icon: "⚡",
    title: "Sfide Giornaliere",
    color: "#fb923c",
    steps: [
      "Cinque sfide bonus sono disponibili ogni giorno",
      "Condizioni: completa tappe, registra spese, fai check-in…",
      "Quando la condizione è soddisfatta, il pulsante Riscatta si illumina",
      "Riscatta i tuoi XP prima di mezzanotte — le sfide si resettano ogni giorno",
    ],
    tip: "💡 Tutte e 5 completate? Stai avendo una grande giornata — mantieni lo slancio!",
  },
];

export default function TutorialClient({
  name,
  isFirstTime,
  heroClass,
}: {
  name?: string | null;
  isFirstTime: boolean;
  heroClass?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      await markOnboardingComplete();
    } catch {
      // ignore — still navigate
    }
    router.push("/dashboard");
  }

  const cls = getClassDef(heroClass);
  const levelTiers = cls.tiers;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-10">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3 animate-bounce" style={{ animationDuration: "2s" }}>📖</div>
        <h1 className="text-2xl font-bold text-[#ede9ff] mb-1">
          {isFirstTime && name ? `Benvenuto, ${name}!` : "Come si gioca"}
        </h1>
        <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
          Tutto quello che devi sapere per dominare le tue missioni.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4 mb-8">
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border p-5"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: s.color + "22", border: `1px solid ${s.color}44` }}
              >
                {s.icon}
              </span>
              <h2 className="text-base font-bold text-[#ede9ff]">{s.title}</h2>
            </div>

            {/* Steps */}
            <div className="space-y-2.5 mb-3">
              {s.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: s.color + "33", color: s.color }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm text-[#c4b5fd]">{step}</p>
                </div>
              ))}
            </div>

            {/* Tip */}
            <p
              className="text-xs rounded-xl px-3 py-2"
              style={{ background: "var(--theme-bg)", color: "var(--theme-text-muted)" }}
            >
              {s.tip}
            </p>
          </div>
        ))}
      </div>

      {/* Level tiers reference */}
      <div
        className="rounded-2xl border p-5 mb-8"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{cls.icon}</span>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--theme-text-muted)" }}>
            Percorso livelli — {cls.name}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {levelTiers.map((t) => (
            <div key={t.label} className="text-center">
              <div className="text-xl mb-0.5">{t.icon}</div>
              <p className="text-xs font-semibold text-[#ede9ff]">{t.label}</p>
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{t.min.toLocaleString()} XP</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {isFirstTime ? (
        <>
          <button
            onClick={handleStart}
            disabled={loading}
            className="block w-full py-4 rounded-2xl font-bold text-center text-base shadow-lg shadow-amber-900/30 active:scale-95 transition-all mb-3 disabled:opacity-60"
            style={{ background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }}
          >
            {loading ? "Caricamento…" : "⚔️ Inizia la mia avventura"}
          </button>
          <p className="text-center text-xs" style={{ color: "var(--theme-text-muted)" }}>
            Puoi rileggere questa guida in qualsiasi momento dal pulsante{" "}
            <span className="font-bold text-[#ede9ff]">?</span> nella bacheca.
          </p>
        </>
      ) : (
        <Link
          href="/dashboard"
          className="block w-full py-4 rounded-2xl font-bold text-center text-base border active:scale-95 transition-all"
          style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}
        >
          ← Torna alla bacheca
        </Link>
      )}
    </div>
  );
}
