"use client";

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";

type SavedRecipe = {
  id: string;
  ingredients: string[];
  content: string;
  createdAt: string;
};

function parseBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const result: React.ReactElement[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    result.push(
      <ul key={`ul${result.length}`} className="space-y-1 my-1 pl-1">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex gap-1.5 items-start text-sm leading-relaxed">
            <span className="shrink-0 mt-0.5" style={{ color: "var(--theme-accent)" }}>›</span>
            <span>{parseBold(item)}</span>
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((line, idx) => {
    if (line.startsWith("- ")) { listBuffer.push(line.slice(2)); return; }
    flushList();
    if (line.trim() === "---") {
      result.push(<hr key={idx} className="my-3 border-t" style={{ borderColor: "var(--theme-surface-border)" }} />);
    } else if (/^#{1,3} /.test(line)) {
      result.push(<p key={idx} className="text-sm font-bold mt-3 mb-1" style={{ color: "var(--theme-accent)" }}>{parseBold(line.replace(/^#{1,3} /, ""))}</p>);
    } else if (line.trim() !== "") {
      result.push(<p key={idx} className="text-sm leading-relaxed">{parseBold(line)}</p>);
    }
  });
  flushList();
  return result;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export default function SvuotaFrigoClient() {
  const [input, setInput] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [streamResult, setStreamResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/svuota-frigo")
      .then(r => r.json())
      .then((data: SavedRecipe[]) => setSaved(Array.isArray(data) ? data : []))
      .catch(() => setSaved([]))
      .finally(() => setLoadingSaved(false));
  }, []);

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

  const generateRecipes = async (ingrOverride?: string[], replaceId?: string) => {
    const ingr = ingrOverride ?? ingredients;
    if (!ingr.length) return;
    setStreamResult("");
    setLoading(true);
    let fullContent = "";
    try {
      const res = await fetch("/api/svuota-frigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: ingr }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore sconosciuto" }));
        setStreamResult(`⚠️ ${err.error ?? "Errore nella generazione"}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        setStreamResult(prev => prev + chunk);
      }
      if (fullContent.trim() && !fullContent.includes("⚠️ Errore")) {
        const saveRes = await fetch("/api/svuota-frigo/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredients: ingr, content: fullContent }),
        });
        if (saveRes.ok) {
          const newRecipe = await saveRes.json() as SavedRecipe;
          // If regenerating, delete the old recipe and replace it in list
          if (replaceId) {
            fetch(`/api/svuota-frigo/${replaceId}`, { method: "DELETE" }).catch(() => {});
            setSaved(prev => prev.map(r => r.id === replaceId ? newRecipe : r));
          } else {
            setSaved(prev => [newRecipe, ...prev]);
          }
          setIngredients([]);
          setStreamResult("");
          setExpandedId(newRecipe.id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteRecipe = async (id: string) => {
    await fetch(`/api/svuota-frigo/${id}`, { method: "DELETE" });
    setSaved(prev => prev.filter(r => r.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const reset = () => {
    setIngredients([]);
    setStreamResult("");
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
          onClick={() => generateRecipes()}
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
        {ingredients.length > 0 && (
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

      {/* Streaming in progress */}
      {streamResult && (
        <div
          className="rounded-2xl border p-4 space-y-2"
          style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
        >
          <p className="text-sm font-semibold text-white">{loading ? "💡 Generando ricette…" : "💡 Ricette generate"}</p>
          {loading ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--theme-text)" }}>
              {streamResult}
              <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ background: "var(--theme-accent)" }} />
            </div>
          ) : (
            <div className="text-sm leading-relaxed space-y-1" style={{ color: "var(--theme-text)" }}>
              {renderMarkdown(streamResult)}
            </div>
          )}
        </div>
      )}

      {/* Saved recipes */}
      {!loadingSaved && (
        <div className="space-y-3">
          {saved.length > 0 && (
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--theme-text-muted)" }}>
              Ricette salvate
            </p>
          )}
          {saved.map(recipe => (
            <div
              key={recipe.id}
              className="rounded-2xl border overflow-hidden"
              style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
            >
              {/* Header row */}
              <button
                onClick={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-lg">🍳</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {recipe.ingredients.join(", ")}
                  </p>
                  <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
                    {formatDate(recipe.createdAt)}
                  </p>
                </div>
                <span className="text-sm transition-transform" style={{ color: "var(--theme-text-muted)", transform: expandedId === recipe.id ? "rotate(90deg)" : "none" }}>
                  ›
                </span>
              </button>

              {/* Expanded content */}
              {expandedId === recipe.id && (
                <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "var(--theme-surface-border)" }}>
                  <div className="text-sm leading-relaxed pt-3 space-y-1" style={{ color: "var(--theme-text)" }}>
                    {renderMarkdown(recipe.content)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setExpandedId(null);
                        generateRecipes(recipe.ingredients, recipe.id);
                      }}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all active:scale-95 font-medium disabled:opacity-40"
                      style={{
                        background: "var(--theme-accent)",
                        color: "var(--theme-bg)",
                      }}
                    >
                      🔄 Rigenera
                    </button>
                    <button
                      onClick={() => deleteRecipe(recipe.id)}
                      className="text-xs px-3 py-1.5 rounded-lg transition-all active:scale-95"
                      style={{
                        background: "var(--theme-bg)",
                        color: "var(--theme-text-muted)",
                        border: "1px solid var(--theme-surface-border)",
                      }}
                    >
                      🗑 Elimina
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loadingSaved && saved.length === 0 && !streamResult && ingredients.length === 0 && (
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
