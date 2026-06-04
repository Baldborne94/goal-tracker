"use client";

import { useState } from "react";
import { completeOnboarding } from "@/app/(setup)/onboarding/actions";
import { THEMES, type ThemeKey } from "@/components/ThemeProvider";

const CLASSES = [
  { key: "warrior", icon: "⚔️", name: "Guerriero", desc: "Disciplina & forza" },
  { key: "ranger",  icon: "🏹", name: "Ranger",    desc: "Costanza & concentrazione" },
  { key: "mage",    icon: "🔮", name: "Mago",      desc: "Conoscenza & crescita" },
  { key: "rogue",   icon: "🗡️", name: "Ladro",     desc: "Velocità & adattabilità" },
];

export default function OnboardingClient({ initialName }: { initialName: string }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [heroName, setHeroName] = useState(initialName);
  const [heroClass, setHeroClass] = useState("warrior");
  const [theme, setTheme] = useState<ThemeKey>("warrior");
  const [saving, setSaving] = useState(false);

  const selectedTheme = THEMES[theme];

  async function handleFinish() {
    if (!heroName.trim()) return;
    setSaving(true);
    await completeOnboarding(heroName.trim(), theme);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: selectedTheme.gradient }}
    >
      <div className="w-full max-w-sm">

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: s === step ? "32px" : "12px",
                background: s <= step ? selectedTheme.accent : "#3b2d6e",
              }}
            />
          ))}
        </div>

        {/* Step 1 — Hero name */}
        {step === 1 && (
          <div className="text-center">
            <div className="text-6xl mb-4">⚔️</div>
            <h1 className="text-2xl font-bold text-[#ede9ff] mb-2">Dai un nome al tuo eroe</h1>
            <p className="text-[#9d8ac7] text-sm mb-8">Così apparirai nel diario delle missioni.</p>

            <input
              autoFocus
              value={heroName}
              onChange={(e) => setHeroName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && heroName.trim() && setStep(2)}
              placeholder="Inserisci nome eroe..."
              maxLength={32}
              className="w-full px-4 py-3 rounded-2xl bg-black/30 border text-[#ede9ff] placeholder-[#4a3a7a] text-center text-lg font-bold focus:outline-none mb-6"
              style={{ borderColor: selectedTheme.border }}
            />

            <button
              onClick={() => setStep(2)}
              disabled={!heroName.trim()}
              className="w-full py-3 rounded-2xl font-bold text-black active:scale-95 transition-all disabled:opacity-40"
              style={{ background: selectedTheme.bar }}
            >
              Continua →
            </button>
          </div>
        )}

        {/* Step 2 — Choose class */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-[#ede9ff] mb-2 text-center">Scegli la tua classe</h1>
            <p className="text-[#9d8ac7] text-sm mb-6 text-center">Il tuo stile di gioco come eroe.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {CLASSES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setHeroClass(c.key)}
                  className="flex flex-col items-center p-4 rounded-2xl border transition-all"
                  style={{
                    borderColor: heroClass === c.key ? selectedTheme.accent : "#3b2d6e",
                    background: heroClass === c.key ? selectedTheme.accent + "22" : "rgba(0,0,0,0.3)",
                  }}
                >
                  <span className="text-3xl mb-2">{c.icon}</span>
                  <span className="text-sm font-bold text-[#ede9ff]">{c.name}</span>
                  <span className="text-xs text-[#9d8ac7] mt-0.5 text-center leading-tight">{c.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-2xl font-semibold text-[#9d8ac7] border border-[#3b2d6e] active:scale-95 transition-all"
              >
                ← Indietro
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-2xl font-bold text-black active:scale-95 transition-all"
                style={{ background: selectedTheme.bar }}
              >
                Continua →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Choose theme */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-[#ede9ff] mb-2 text-center">Scegli il tuo regno</h1>
            <p className="text-[#9d8ac7] text-sm mb-6 text-center">Scegli un tema visivo per il tuo percorso.</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {(Object.values(THEMES) as (typeof THEMES)[ThemeKey][]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key as ThemeKey)}
                  className="flex flex-col items-center p-4 rounded-2xl border transition-all"
                  style={{
                    borderColor: theme === t.key ? t.accent : "#3b2d6e",
                    background: theme === t.key ? t.accent + "22" : "rgba(0,0,0,0.3)",
                  }}
                >
                  <div className="w-8 h-8 rounded-full mb-2" style={{ background: t.bar }} />
                  <span className="text-sm font-bold text-[#ede9ff]">{t.name}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-2xl font-semibold text-[#9d8ac7] border border-[#3b2d6e] active:scale-95 transition-all"
              >
                ← Indietro
              </button>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl font-bold text-black active:scale-95 transition-all disabled:opacity-60"
                style={{ background: selectedTheme.bar }}
              >
                {saving ? "Creazione..." : "⚔️ Inizia la missione!"}
              </button>
            </div>
          </div>
        )}

        {/* Preview footer */}
        <p className="text-center text-xs text-[#4a3a7a] mt-6">
          {heroName.trim() ? `Eroe: ${heroName}` : "Dai un nome al tuo eroe per continuare"}
        </p>
      </div>
    </div>
  );
}
