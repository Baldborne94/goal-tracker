"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { markOnboardingComplete } from "@/app/(app)/profile/actions";
import { getClassDef } from "@/lib/classes";

type Slide = {
  kind?: "welcome" | "levels" | "final";
  icon: string;
  accent: string;
  tag: string;
  title: string;
  body?: string;
  bullets?: string[];
  tip?: string;
};

const SLIDES: Slide[] = [
  {
    kind: "welcome",
    icon: "📖",
    accent: "#a78bfa",
    tag: "Benvenuto",
    title: "Come si gioca",
    body: "Goal Tracker trasforma i tuoi obiettivi in missioni da eroe. Scorri per scoprire tutto: missioni, XP, finanze, dieta, palestra e molto altro.",
    tip: "💡 Puoi rileggere questa guida quando vuoi dal pulsante ? nella bacheca.",
  },
  {
    icon: "⚔️",
    accent: "#f59e0b",
    tag: "Missioni",
    title: "Missioni e Tappe",
    bullets: [
      "Crea una missione con titolo, scadenza, categoria e priorità",
      "Dividila in tappe — ogni tappa è un passo concreto avanti",
      "Completa le tappe per guadagnare XP e far salire la barra di progresso",
      "Quando tutte le tappe sono completate, la missione si conclude",
    ],
    tip: "💡 Niente tappe? Abilita il check-in giornaliero e traccia i progressi giorno per giorno.",
  },
  {
    icon: "📅",
    accent: "#34d399",
    tag: "Costanza",
    title: "Check-in Giornaliero e Serie",
    bullets: [
      "Abilita il check-in giornaliero su qualsiasi missione",
      "Torna ogni giorno e premi Check In per guadagnare XP",
      "Puoi limitare i check-in a giorni specifici della settimana",
      "I giorni consecutivi formano una serie mostrata nella bacheca",
    ],
    tip: "💡 La serie si azzera se salti un giorno pianificato — la costanza è la chiave!",
  },
  {
    icon: "🔁",
    accent: "#60a5fa",
    tag: "Ricorrenza",
    title: "Missioni Ricorrenti",
    bullets: [
      "Imposta una missione come ricorrente: settimanale o mensile",
      "Quando la completi, si rigenera in automatico con una nuova scadenza",
      "Le tappe vengono ricopiate sulla nuova istanza",
      "Perfette per abitudini che si ripetono nel tempo",
    ],
    tip: "💡 Combina ricorrenza + check-in per le routine che vuoi mantenere ogni settimana.",
  },
  {
    kind: "levels",
    icon: "✨",
    accent: "#c084fc",
    tag: "Progressione",
    title: "XP e Livelli",
    bullets: [
      "Ogni tappa completata vale XP (predefinito: 10 XP)",
      "Gli XP si accumulano e fanno salire di livello il tuo eroe",
      "L'icona del livello nella barra cambia man mano che cresci",
    ],
  },
  {
    icon: "⚡",
    accent: "#fb923c",
    tag: "Sfide",
    title: "Sfide Giornaliere",
    bullets: [
      "Ogni giorno trovi cinque sfide bonus nella bacheca",
      "Condizioni varie: completa tappe, registra spese, fai check-in, logga un pasto…",
      "Quando la condizione è soddisfatta, il pulsante Riscatta si illumina",
      "Riscatta gli XP prima di mezzanotte — le sfide si resettano ogni giorno",
    ],
    tip: "💡 Il gruppo di sfide ruota ogni 7 giorni per tenerle sempre fresche.",
  },
  {
    icon: "💎",
    accent: "#38bdf8",
    tag: "Tesoro",
    title: "Finanze (Tesoro)",
    bullets: [
      "Imposta un budget mensile e registra le spese per categoria",
      "Il grafico a ciambella e il trend a 12 mesi mostrano dove vanno i soldi",
      "Importa gli estratti conto direttamente dai file Excel di ISYbank",
      "Chiudi il mese sotto budget per 25 XP bonus + trofeo",
    ],
    tip: "💡 Usa i filtri per categoria nel registro giornaliero per analizzare le uscite.",
  },
  {
    icon: "🥗",
    accent: "#4ade80",
    tag: "Alchimia",
    title: "Dieta",
    bullets: [
      "Registra gli alimenti e tieni sotto controllo le calorie giornaliere",
      "Ogni pasto registrato conta per la sfida giornaliera del diario alimentare",
      "La lista della spesa vive nella sezione Vita, con categorie e spunte",
    ],
    tip: "💡 Registrare i pasti con costanza rende utili anche i grafici del peso.",
  },
  {
    icon: "⚗️",
    accent: "#2dd4bf",
    tag: "Allenamento",
    title: "Palestra, Peso e Abitudini",
    bullets: [
      "Palestra: gestisci il programma, aggiungi o rimuovi esercizi e logga gli allenamenti",
      "Peso: aggiungi le misurazioni e segui l'andamento nel tempo",
      "Abitudini: traccia le abitudini quotidiane con un tocco",
      "Routine: organizza le tue routine ricorrenti",
    ],
    tip: "💡 Tutta la sezione Vita è pensata per il benessere oltre alle missioni.",
  },
  {
    icon: "🧑‍🍳",
    accent: "#f472b6",
    tag: "Intelligenza Artificiale",
    title: "Svuota Frigo",
    bullets: [
      "Indica gli ingredienti che hai in casa",
      "L'AI ti propone ricette che li usano tutti insieme",
      "Le ricette restano salvate finché non le elimini tu",
      "Premi Rigenera per sostituire una ricetta con una nuova idea",
    ],
    tip: "💡 C'è un limite giornaliero di generazioni AI per tenere tutto sostenibile.",
  },
  {
    icon: "🔔",
    accent: "#facc15",
    tag: "Promemoria",
    title: "Notifiche",
    bullets: [
      "Notifiche Push: ricevi i promemoria anche con l'app chiusa",
      "Promemoria Giornaliero: un avviso all'orario che scegli tu",
      "Attiva tutto dalla scheda Eroe → sezione Notifiche",
      "Se le hai bloccate, riabilitale dalle impostazioni del telefono",
    ],
    tip: "💡 Su Android, dopo aver sbloccato il permesso, riapri l'app per aggiornare lo stato.",
  },
  {
    icon: "🛡️",
    accent: "#fb7185",
    tag: "Eroe",
    title: "Profilo, Temi e Trofei",
    bullets: [
      "Personalizza nome e classe del tuo eroe",
      "Scegli tra 4 temi: Warrior, Ocean, Forest, Crimson",
      "Sblocca trofei completando obiettivi e traguardi",
      "Consulta le tue statistiche; puoi azzerare tutto se vuoi ricominciare",
    ],
    tip: "💡 Il tema scelto ti segue su tutti i dispositivi — è salvato sul tuo profilo.",
  },
  {
    kind: "final",
    icon: "🎯",
    accent: "#f59e0b",
    tag: "Pronto?",
    title: "Inizia l'avventura",
    body: "Ora conosci tutto il necessario per dominare le tue missioni. Il tuo regno ti aspetta, eroe.",
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
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const cls = getClassDef(heroClass);
  const last = SLIDES.length - 1;
  const atFirst = i === 0;
  const atLast = i === last;

  const go = (n: number) => setI(Math.max(0, Math.min(last, n)));

  async function finish() {
    setLoading(true);
    try {
      if (isFirstTime) await markOnboardingComplete();
    } catch {
      // ignore — still navigate
    }
    router.push("/dashboard");
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx <= -50) go(i + 1);
    else if (dx >= 50) go(i - 1);
    touchStartX.current = null;
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-28 flex flex-col justify-center" style={{ minHeight: "100dvh" }}>
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {SLIDES.map((s, idx) => (
          <button
            key={idx}
            onClick={() => go(idx)}
            aria-label={`Vai alla slide ${idx + 1}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: idx === i ? 22 : 6,
              background: idx === i ? s.accent : "var(--theme-surface-border)",
            }}
          />
        ))}
      </div>

      {/* Carousel viewport */}
      <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex items-stretch transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {SLIDES.map((s, idx) => (
            <div key={idx} className="w-full flex-shrink-0 px-1">
              <Slide slide={s} name={name} isFirstTime={isFirstTime} cls={cls} active={idx === i} />
            </div>
          ))}
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-3 mt-6">
        <button
          onClick={() => (atFirst ? finish() : go(i - 1))}
          disabled={loading}
          className="px-4 py-3 rounded-2xl text-sm font-medium active:scale-95 transition-all disabled:opacity-50"
          style={{ color: "var(--theme-text-muted)" }}
        >
          {atFirst ? "Salta" : "← Indietro"}
        </button>

        {atLast ? (
          <button
            onClick={finish}
            disabled={loading}
            className="flex-1 py-3.5 rounded-2xl font-bold text-center text-base shadow-lg shadow-amber-900/30 active:scale-95 transition-all disabled:opacity-60"
            style={{ background: "linear-gradient(to right, #f59e0b, #eab308)", color: "#000" }}
          >
            {loading ? "Caricamento…" : isFirstTime ? "⚔️ Inizia la mia avventura" : "Torna alla bacheca"}
          </button>
        ) : (
          <button
            onClick={() => go(i + 1)}
            className="flex-1 py-3.5 rounded-2xl font-bold text-center text-base active:scale-95 transition-all"
            style={{ background: SLIDES[i].accent, color: "#0a0a0a" }}
          >
            Avanti →
          </button>
        )}
      </div>
    </div>
  );
}

function Slide({
  slide,
  name,
  isFirstTime,
  cls,
  active,
}: {
  slide: Slide;
  name?: string | null;
  isFirstTime: boolean;
  cls: ReturnType<typeof getClassDef>;
  active: boolean;
}) {
  const title =
    slide.kind === "welcome" && isFirstTime && name ? `Benvenuto, ${name}!` : slide.title;

  return (
    <div className="h-full flex flex-col items-center justify-center text-center" style={{ minHeight: "56vh" }}>
      {/* Icon */}
      <div
        className="mt-2 mb-6 w-28 h-28 rounded-3xl flex items-center justify-center"
        style={{
          background: `${slide.accent}1f`,
          border: `1px solid ${slide.accent}44`,
        }}
      >
        <span
          className={active ? "text-6xl animate-bounce" : "text-6xl"}
          style={{ animationDuration: "2s" }}
        >
          {slide.icon}
        </span>
      </div>

      {/* Tag */}
      <p
        className="text-xs font-bold uppercase tracking-[0.2em] mb-2"
        style={{ color: slide.accent }}
      >
        {slide.tag}
      </p>

      {/* Title */}
      <h1 className="text-2xl font-bold text-[#ede9ff] mb-3">{title}</h1>

      {/* Body */}
      {slide.body && (
        <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--theme-text-muted)" }}>
          {slide.body}
        </p>
      )}

      {/* Bullets */}
      {slide.bullets && (
        <div className="w-full text-left space-y-2.5 mt-3">
          {slide.bullets.map((b, k) => (
            <div key={k} className="flex items-start gap-2.5">
              <span className="text-sm mt-0.5 flex-shrink-0" style={{ color: slide.accent }}>
                ✦
              </span>
              <p className="text-sm text-[#c4b5fd] leading-snug">{b}</p>
            </div>
          ))}
        </div>
      )}

      {/* Level tiers (levels slide only) */}
      {slide.kind === "levels" && (
        <div
          className="w-full rounded-2xl border p-4 mt-5"
          style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-lg">{cls.icon}</span>
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--theme-text-muted)" }}
            >
              Percorso livelli — {cls.name}
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {cls.tiers.map((t) => (
              <div key={t.label} className="text-center">
                <div className="text-xl mb-0.5">{t.icon}</div>
                <p className="text-[11px] font-semibold text-[#ede9ff] leading-tight">{t.label}</p>
                <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>
                  {t.min.toLocaleString()} XP
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tip */}
      {slide.tip && (
        <p
          className="text-xs rounded-xl px-3 py-2.5 mt-5 w-full"
          style={{ background: "var(--theme-surface)", color: "var(--theme-text-muted)" }}
        >
          {slide.tip}
        </p>
      )}
    </div>
  );
}
