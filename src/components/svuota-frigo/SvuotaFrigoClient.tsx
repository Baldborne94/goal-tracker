"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";

export default function SvuotaFrigoClient() {
  const [input, setInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addIngredient = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const parts = trimmed.split(",").map(s => s.trim()).filter(Boolean);
    setIngredients(prev => {
      const existing = new Set(prev.map(i => i.toLowerCase()));
      return [...prev, ...parts.filter(p => !existing.has(p.toLowerCase()))];
    });
    setInput("");
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addIngredient();
    }
  };

  const removeIngredient = (idx: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  const generateRecipes = async () => {
    if (!ingredients.length) return;
    setResult("");
    setLoading(true);
    try {
      const res = await fetch("/api/svuota-frigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore sconosciuto" }));
        setResult(`⚠️ ${err.error ?? "Errore nella generazione"}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResult(prev => prev + decoder.decode(value, { stream: true }));
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setIngredients([]);
    setResult("");
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--theme-accent)" }}>🧊 Svuota Frigo</h1>
        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
          Inserisci gli ingredienti che hai e scopri cosa cucinare
        </p>
      </div>

      {/* Ingredient input */}
      <div
        className="rounded-2xl border p-4 space-y-3"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <p className="text-sm font-semibold text-white">Ingredienti disponibili</p>

        {/* Chips */}
        {ingredients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ingredients.map((ing, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: "var(--theme-accent)", color: "var(--theme-bg)" }}
              >
                {ing}
                <button
                  onClick={() => removeIngredient(i)}
                  className="ml-1 opacity-70 hover:opacity-100 font-bold leading-none"
                  aria-label={`Rimuovi ${ing}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="es. uova, formaggio, spinaci…"
            className="flex-1 text-sm px-3 py-2 rounded-xl outline-none"
            style={{
              background: "var(--theme-bg)",
              color: "var(--theme-text)",
              border: "1px solid var(--theme-surface-border)",
            }}
          />
          <button
            onClick={addIngredient}
            disabled={!input.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "var(--theme-accent)", color: "var(--theme-bg)" }}
          >
            +
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
          Premi Invio o virgola per aggiungere più ingredienti
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={generateRecipes}
          disabled={!ingredients.length || loading}
          className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: "var(--theme-accent)", color: "var(--theme-bg)" }}
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--theme-bg)", borderTopColor: "transparent" }} />
              Generando…
            </>
          ) : (
            <>🍳 Genera Ricette</>
          )}
        </button>
        {(ingredients.length > 0 || result) && (
          <button
            onClick={reset}
            className="px-4 py-3 rounded-2xl text-sm font-medium transition-all active:scale-95"
            style={{
              background: "var(--theme-surface)",
              color: "var(--theme-text-muted)",
              border: "1px solid var(--theme-surface-border)",
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Streaming result */}
      {result && (
        <div
          className="rounded-2xl border p-4 space-y-2"
          style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
        >
          <p className="text-sm font-semibold text-white">💡 Ricette suggerite</p>
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--theme-text)" }}
          >
            {result}
            {loading && <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ background: "var(--theme-accent)" }} />}
          </div>
        </div>
      )}

      {!result && !loading && ingredients.length === 0 && (
        <div
          className="rounded-2xl border p-6 text-center"
          style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
        >
          <p className="text-3xl mb-2">🧊</p>
          <p className="text-sm font-medium text-white">Cosa c&apos;è in frigo?</p>
          <p className="text-xs mt-1" style={{ color: "var(--theme-text-muted)" }}>
            Aggiungi gli ingredienti che hai e l&apos;AI ti suggerirà delle ricette
          </p>
        </div>
      )}
    </div>
  );
}
