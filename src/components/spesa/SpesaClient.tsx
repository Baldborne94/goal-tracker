"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { WEEKLY_PLAN } from "@/lib/meal-plan";
import { cn } from "@/lib/utils";

type ShoppingItem = {
  id: string;
  name: string;
  quantity: string | null;
  checked: boolean;
  category: string;
};

const CATEGORIES = [
  { key: "frutta-verdura", label: "Frutta/Verdura", icon: "🥬" },
  { key: "proteine",       label: "Proteine",        icon: "🥩" },
  { key: "latticini",      label: "Latticini",       icon: "🧀" },
  { key: "cereali",        label: "Cereali/Legumi",  icon: "🌾" },
  { key: "condimenti",     label: "Condimenti",      icon: "🫙" },
  { key: "altro",          label: "Altro",            icon: "🛒" },
];

const catIcon = (key: string) => CATEGORIES.find(c => c.key === key)?.icon ?? "🛒";

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/fragole|mela|lamponi|ciliegie|albicocche|pesca|pomodori|rucola|lattuga|finocchi|zucchine|melanzane|peperone|cipolla|carote|avocado|spinaci|insalata|succo|arancia|spremuta/.test(n)) return "frutta-verdura";
  if (/tonno|salmone|uovo|tacchino|pollo|sgombro|albume|prosciutto|hamburger|carne|merluzzo/.test(n)) return "proteine";
  if (/yogurt|latte|mozzarella|parmigiano|asiago|sottilette|burro|formaggio|ricotta/.test(n)) return "latticini";
  if (/pasta|riso|pane|fagioli|lenticchie|gnocchi|gallette|biscotti|patate|cereali|avena/.test(n)) return "cereali";
  if (/olio|aceto|marmellata|crema|basilico|sale|pepe|spezie/.test(n)) return "condimenti";
  return "altro";
}

function getAllMealPlanFoods(): { name: string; category: string }[] {
  const seen = new Set<string>();
  const result: { name: string; category: string }[] = [];
  for (const day of WEEKLY_PLAN) {
    for (const meal of day.meals) {
      for (const food of meal.foods) {
        const key = food.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ name: food.name, category: guessCategory(food.name) });
        }
      }
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export default function SpesaClient() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("altro");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetch("/api/spesa")
      .then(r => r.json())
      .then(data => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, []);

  const allPlanFoods = useMemo(() => getAllMealPlanFoods(), []);

  const suggestions = useMemo(() => {
    const existingNames = new Set(items.map(i => i.name.toLowerCase()));
    return allPlanFoods.filter(f => !existingNames.has(f.name.toLowerCase()));
  }, [allPlanFoods, items]);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    const res = await fetch("/api/spesa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), quantity: quantity.trim() || null, category }),
    });
    const item = await res.json();
    setItems(prev => [...prev, item]);
    setName("");
    setQuantity("");
    setShowForm(false);
    setAdding(false);
  };

  const addSuggestion = async (food: { name: string; category: string }) => {
    const tempId = `tmp_${Date.now()}`;
    // Show item immediately, reset filter so it's visible, collapse suggestions
    setItems(prev => [...prev, { id: tempId, name: food.name, quantity: null, checked: false, category: food.category }]);
    setFilterCat(null);
    setShowSuggestions(false);
    try {
      const res = await fetch("/api/spesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: food.name, quantity: null, category: food.category }),
      });
      if (res.ok) {
        const item = await res.json();
        if (item.id) setItems(prev => prev.map(i => i.id === tempId ? item : i));
      }
      // On API error: item stays in list for this session (won't persist on refresh)
    } catch {
      // Network error: item stays in list for this session
    }
  };

  const toggleItem = async (item: ShoppingItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: !i.checked } : i));
    await fetch(`/api/spesa/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: !item.checked }),
    });
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/spesa/${id}`, { method: "DELETE" });
  };

  const clearCompleted = async () => {
    const done = items.filter(i => i.checked);
    setItems(prev => prev.filter(i => !i.checked));
    await Promise.all(done.map(i => fetch(`/api/spesa/${i.id}`, { method: "DELETE" })));
  };

  const visible = (i: ShoppingItem) => !filterCat || i.category === filterCat;
  const unchecked = items.filter(i => !i.checked && visible(i));
  const checked = items.filter(i => i.checked && visible(i));
  const completedCount = items.filter(i => i.checked).length;

  return (
    <div className="p-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header with back arrow */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/vita"
            className="flex items-center justify-center w-9 h-9 rounded-xl border transition-all active:scale-90 shrink-0"
            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}
          >
            ←
          </Link>
          <div>
            <h1 className="text-xl font-bold text-amber-400">🛒 Lista della Spesa</h1>
            <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>
              {unchecked.length} da comprare · {completedCount} acquistati
            </p>
          </div>
        </div>
        {completedCount > 0 && (
          <button
            onClick={clearCompleted}
            className="text-xs px-3 py-1.5 rounded-lg border mt-1 shrink-0"
            style={{ color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }}
          >
            Svuota completati
          </button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterCat(null)}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
            !filterCat ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "border-gray-700 text-gray-400"
          )}
        >
          Tutti
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setFilterCat(filterCat === c.key ? null : c.key)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              filterCat === c.key ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "border-gray-700 text-gray-400"
            )}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm ? (
        <form
          onSubmit={addItem}
          className="rounded-2xl border p-4 space-y-3"
          style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
        >
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome prodotto…"
            className="w-full bg-transparent border rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text)" }}
          />
          <div className="flex gap-2">
            <input
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Quantità (es. 500g)"
              className="flex-1 bg-transparent border rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text)" }}
            />
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{
                borderColor: "var(--theme-surface-border)",
                color: "var(--theme-text)",
                background: "var(--theme-surface)",
              }}
            >
              {CATEGORIES.map(c => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 rounded-xl text-sm border"
              style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={adding || !name.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-black disabled:opacity-50"
            >
              {adding ? "Aggiunta…" : "Aggiungi"}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-2xl border border-dashed text-sm font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
          style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
        >
          + Aggiungi prodotto
        </button>
      )}

      {/* Suggestions from meal plan */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--theme-surface-border)" }}>
        <button
          onClick={() => setShowSuggestions(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3"
          style={{ background: "var(--theme-surface)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🥗</span>
            <span className="text-sm font-medium text-white">Suggerimenti dalla scheda</span>
            {suggestions.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
                {suggestions.length}
              </span>
            )}
          </div>
          <span className="text-gray-500 text-sm">{showSuggestions ? "▲" : "▼"}</span>
        </button>

        {showSuggestions && (
          <div style={{ background: "var(--theme-bg)" }}>
            {suggestions.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-500">
                Tutti gli ingredienti della scheda sono già in lista. ✓
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--theme-surface-border)" }}>
                {suggestions.map(food => (
                  <div
                    key={food.name}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{catIcon(food.category)}</span>
                      <span className="text-sm" style={{ color: "var(--theme-text)" }}>{food.name}</span>
                    </div>
                    <button
                      onClick={() => addSuggestion(food)}
                      className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-medium active:scale-95 transition-all"
                    >
                      + Aggiungi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {loading && (
        <p className="text-center py-8 text-sm text-gray-500">Caricamento…</p>
      )}

      {!loading && unchecked.length === 0 && checked.length === 0 && items.length === 0 && (
        <div className="text-center py-10 space-y-1">
          <p className="text-3xl">🛒</p>
          <p className="text-sm text-gray-500">La lista è vuota.</p>
          <p className="text-xs text-gray-600">Aggiungi prodotti o usa i suggerimenti dalla scheda.</p>
        </div>
      )}

      {!loading && unchecked.length > 0 && (
        <div className="space-y-2">
          {unchecked.map(item => (
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
          ))}
        </div>
      )}

      {!loading && checked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium px-1" style={{ color: "var(--theme-text-muted)" }}>
            ✓ Nel carrello
          </p>
          {checked.map(item => (
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item, onToggle, onDelete,
}: {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all",
        item.checked && "opacity-60"
      )}
      style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
    >
      <button
        onClick={() => onToggle(item)}
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all text-xs font-bold",
          item.checked ? "bg-green-500 border-green-500 text-white" : "border-gray-600"
        )}
      >
        {item.checked && "✓"}
      </button>

      <span className="text-lg shrink-0">{catIcon(item.category)}</span>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          item.checked ? "line-through text-gray-500" : "text-white"
        )}>
          {item.name}
        </p>
        {item.quantity && (
          <p className="text-xs text-amber-400/70">{item.quantity}</p>
        )}
      </div>

      <button
        onClick={() => onDelete(item.id)}
        className="text-gray-600 hover:text-red-400 transition-colors p-1 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
