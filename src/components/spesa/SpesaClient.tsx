"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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


export default function SpesaClient() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("altro");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spesa")
      .then(r => r.json())
      .then(data => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, []);

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

  const editItem = async (id: string, name: string, quantity: string | null) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, name, quantity } : i));
    await fetch(`/api/spesa/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, quantity }),
    });
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

  const resetCompleted = async () => {
    const done = items.filter(i => i.checked);
    setItems(prev => prev.map(i => i.checked ? { ...i, checked: false } : i));
    await Promise.all(done.map(i => fetch(`/api/spesa/${i.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked: false }),
    })));
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
            onClick={resetCompleted}
            className="text-xs px-3 py-1.5 rounded-lg border mt-1 shrink-0"
            style={{ color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }}
          >
            🔄 Ricomincia la spesa
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
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} onEdit={editItem} />
          ))}
        </div>
      )}

      {!loading && checked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium px-1" style={{ color: "var(--theme-text-muted)" }}>
            ✓ Nel carrello
          </p>
          {checked.map(item => (
            <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} onEdit={editItem} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item, onToggle, onDelete, onEdit,
}: {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, name: string, quantity: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(item.quantity ?? "");

  const startEdit = () => {
    setEditName(item.name);
    setEditQty(item.quantity ?? "");
    setEditing(true);
  };

  const save = () => {
    if (!editName.trim()) return;
    onEdit(item.id, editName.trim(), editQty.trim() || null);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div
        className="rounded-2xl border px-4 py-3 space-y-2"
        style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
      >
        <input
          autoFocus
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="w-full bg-transparent border rounded-xl px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text)" }}
        />
        <div className="flex gap-2">
          <input
            value={editQty}
            onChange={e => setEditQty(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
            placeholder="Quantità (es. 500g)"
            className="flex-1 bg-transparent border rounded-xl px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text)" }}
          />
          <button
            onClick={cancel}
            className="px-3 py-2 rounded-xl text-sm border"
            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
          >
            ✕
          </button>
          <button
            onClick={save}
            disabled={!editName.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-black disabled:opacity-50"
          >
            Salva
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 transition-all",
        item.checked && "opacity-70"
      )}
      style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
    >
      <div className="flex items-center gap-3">
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

        {item.checked ? (
          <button onClick={() => onToggle(item)} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate line-through text-gray-500">{item.name}</p>
            {item.quantity && <p className="text-xs text-amber-400/70">{item.quantity}</p>}
          </button>
        ) : (
          <button onClick={startEdit} className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium truncate text-white">{item.name}</p>
            {item.quantity && <p className="text-xs text-amber-400/70">{item.quantity}</p>}
          </button>
        )}

        <button
          onClick={() => onDelete(item.id)}
          className="text-gray-600 hover:text-red-400 transition-colors p-1 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {item.checked && (
        <div className="mt-2 pt-2 border-t flex justify-start" style={{ borderColor: "var(--theme-surface-border)" }}>
          <button
            onClick={() => onToggle(item)}
            className="text-xs px-3 py-1 rounded-lg font-medium transition-all active:scale-95"
            style={{ background: "var(--theme-bg)", color: "var(--theme-text-muted)" }}
          >
            ↩ Rimetti in lista
          </button>
        </div>
      )}
    </div>
  );
}
