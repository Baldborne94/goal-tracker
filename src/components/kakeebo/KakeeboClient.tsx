"use client";

import { useState, useEffect, useCallback } from "react";

const CATEGORIES = [
  { value: "cibo", label: "Cibo", icon: "🍕" },
  { value: "trasporti", label: "Trasporti", icon: "🚗" },
  { value: "svago", label: "Svago", icon: "🎮" },
  { value: "casa", label: "Casa", icon: "🏠" },
  { value: "salute", label: "Salute", icon: "💊" },
  { value: "hobby", label: "Hobby", icon: "🎲" },
  { value: "extra", label: "Extra", icon: "📦" },
];

type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  merchant: string | null;
  date: string;
};

type Budget = { id: string; month: string; amount: number; closed?: boolean } | null;

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(m: string) {
  const [year, month] = m.split("-");
  return new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(m: string, delta: number) {
  const [year, month] = m.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCatInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? { icon: "📦", label: value };
}

const emptyForm = () => ({
  amount: "",
  category: "extra",
  description: "",
  merchant: "",
  date: new Date().toISOString().slice(0, 10),
});

export default function KakeeboClient() {
  const [month, setMonth] = useState(currentMonthStr());
  const [budget, setBudget] = useState<Budget>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [closeMsg, setCloseMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, eRes] = await Promise.all([
        fetch(`/api/kakeebo/budget?month=${month}`),
        fetch(`/api/kakeebo/expenses?month=${month}`),
      ]);
      const [bData, eData] = await Promise.all([bRes.json(), eRes.json()]);
      setBudget(bData && !bData.error ? bData : null);
      setExpenses(Array.isArray(eData) ? eData : []);
    } catch {
      setBudget(null);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
    setCloseMsg(null);
  }, [fetchData]);

  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget ? budget.amount - totalSpent : null;
  const pct = budget ? Math.min((totalSpent / budget.amount) * 100, 100) : 0;

  async function saveBudget() {
    if (!budgetInput) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kakeebo/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, amount: budgetInput }),
      });
      if (res.ok) {
        setShowBudgetForm(false);
        setBudgetInput("");
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveExpense() {
    if (!form.amount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kakeebo/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowExpenseForm(false);
        setForm(emptyForm());
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function closeMonth() {
    setSaving(true);
    try {
      const res = await fetch("/api/kakeebo/close-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (data.success) {
        setCloseMsg(`+${data.xpEarned} XP guadagnati! 🎉`);
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: string) {
    await fetch(`/api/kakeebo/expenses/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#ede9ff] mb-6">📒 Kakeebo</h1>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#16112e] border border-[#3b2d6e] text-[#9d8ac7] text-xl hover:border-amber-500/40 transition-colors"
        >
          ‹
        </button>
        <span className="text-[#ede9ff] font-semibold capitalize">{formatMonthLabel(month)}</span>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#16112e] border border-[#3b2d6e] text-[#9d8ac7] text-xl hover:border-amber-500/40 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Budget card */}
      {!showBudgetForm && (
        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-5">
          {budget ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[#9d8ac7]">💰 Budget mensile</span>
                <button
                  onClick={() => {
                    setBudgetInput(String(budget.amount));
                    setShowBudgetForm(true);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  Modifica
                </button>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <div>
                  <p className="text-[#6b5a9e] text-xs mb-0.5">Budget</p>
                  <p className="text-[#ede9ff] font-bold">€{budget.amount.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[#6b5a9e] text-xs mb-0.5">Speso</p>
                  <p className="text-amber-400 font-bold">€{totalSpent.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[#6b5a9e] text-xs mb-0.5">Rimanente</p>
                  <p className={`font-bold ${remaining! < 0 ? "text-red-400" : "text-violet-300"}`}>
                    {remaining! < 0 ? "-" : ""}€{Math.abs(remaining!).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="h-2 bg-[#0f0d22] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-violet-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Close month / reward section */}
              <div className="mt-3 pt-3 border-t border-[#3b2d6e]">
                {budget.closed ? (
                  <p className="text-center text-amber-400 text-xs font-medium">✅ Mese completato — premio riscosso!</p>
                ) : closeMsg ? (
                  <p className="text-center text-amber-400 text-sm font-bold">{closeMsg}</p>
                ) : remaining! >= 0 ? (
                  <button
                    onClick={closeMonth}
                    disabled={saving}
                    className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-50"
                  >
                    🏆 Riscuoti premio mensile (+25 XP)
                  </button>
                ) : (
                  <p className="text-center text-red-400 text-xs">Hai superato il budget — nessun premio disponibile</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-[#9d8ac7] text-sm mb-3">Nessun budget impostato per questo mese</p>
              <button
                onClick={() => setShowBudgetForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold"
              >
                Imposta budget
              </button>
            </div>
          )}
        </div>
      )}

      {/* Budget form */}
      {showBudgetForm && (
        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-5">
          <p className="text-sm font-semibold text-[#ede9ff] mb-3">💰 Budget mensile (€)</p>
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder="es. 500"
            className="w-full bg-[#0f0d22] text-[#ede9ff] border border-[#3b2d6e] rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-violet-500"
          />
          <div className="flex gap-2">
            <button
              onClick={saveBudget}
              disabled={saving || !budgetInput}
              className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-50"
            >
              Salva
            </button>
            <button
              onClick={() => {
                setShowBudgetForm(false);
                setBudgetInput("");
              }}
              className="flex-1 py-2 bg-[#0f0d22] text-[#9d8ac7] border border-[#3b2d6e] rounded-xl text-sm"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Add expense form */}
      {showExpenseForm && (
        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-5">
          <p className="text-sm font-semibold text-[#ede9ff] mb-3">➕ Nuova spesa</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[#6b5a9e] mb-1 block">Importo (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-[#0f0d22] text-[#ede9ff] border border-[#3b2d6e] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="text-xs text-[#6b5a9e] mb-1 block">Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full bg-[#0f0d22] text-[#ede9ff] border border-[#3b2d6e] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#6b5a9e] mb-1 block">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full bg-[#0f0d22] text-[#ede9ff] border border-[#3b2d6e] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#6b5a9e] mb-1 block">Dove</label>
              <input
                type="text"
                value={form.merchant}
                onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
                placeholder="es. Esselunga, Amazon…"
                className="w-full bg-[#0f0d22] text-[#ede9ff] border border-[#3b2d6e] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="text-xs text-[#6b5a9e] mb-1 block">Cosa (opzionale)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descrizione…"
                className="w-full bg-[#0f0d22] text-[#ede9ff] border border-[#3b2d6e] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveExpense}
                disabled={saving || !form.amount}
                className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-50"
              >
                Aggiungi
              </button>
              <button
                onClick={() => setShowExpenseForm(false)}
                className="flex-1 py-2 bg-[#0f0d22] text-[#9d8ac7] border border-[#3b2d6e] rounded-xl text-sm"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense list */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">📜 Spese</h2>
        {!showExpenseForm && (
          <button
            onClick={() => setShowExpenseForm(true)}
            className="text-sm text-amber-400 font-medium hover:text-amber-300"
          >
            + Aggiungi
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#6b5a9e] text-sm">Caricamento…</div>
      ) : expenses.length === 0 ? (
        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-8 text-center">
          <div className="text-4xl mb-3">📒</div>
          <p className="text-[#9d8ac7] text-sm">Nessuna spesa registrata</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => {
            const cat = getCatInfo(e.category);
            return (
              <div
                key={e.id}
                className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] px-4 py-3 flex items-center gap-3"
              >
                <span className="text-2xl flex-shrink-0">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs text-[#6b5a9e] font-medium">{cat.label}</span>
                    {e.merchant && (
                      <span className="text-sm text-[#ede9ff] font-medium truncate">{e.merchant}</span>
                    )}
                  </div>
                  {e.description && (
                    <p className="text-xs text-[#6b5a9e] truncate">{e.description}</p>
                  )}
                  <p className="text-xs text-[#6b5a9e]">
                    {new Date(e.date).toLocaleDateString("it-IT", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-amber-400 font-bold text-sm">€{e.amount.toFixed(2)}</span>
                  <button
                    onClick={() => deleteExpense(e.id)}
                    className="text-[#6b5a9e] hover:text-red-400 text-xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
