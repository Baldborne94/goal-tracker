"use client";

import { useState, useMemo } from "react";

const CATS: Record<string, { icon: string; color: string; label: string }> = {
  food:      { icon: "🍕", color: "#f59e0b", label: "Food" },
  transport: { icon: "🚗", color: "#3b82f6", label: "Transport" },
  leisure:   { icon: "🎮", color: "#a855f7", label: "Leisure" },
  home:      { icon: "🏠", color: "#22c55e", label: "Home" },
  health:    { icon: "💊", color: "#ec4899", label: "Health" },
  hobby:     { icon: "🎨", color: "#06b6d4", label: "Hobby" },
  savings:   { icon: "💰", color: "#fbbf24", label: "Savings" },
  other:     { icon: "📦", color: "#6b7280", label: "Other" },
};

type Budget = { id: string; month: string; amount: number; closed?: boolean } | null;
type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  merchant: string | null;
  date: string;
};
type TrendPoint = { month: string; label: string; spent: number; budget: number | null };

type Props = {
  initialMonth: string;
  initialBudget: Budget;
  initialExpenses: Expense[];
  trend: TrendPoint[];
};

// SVG donut chart — renders category spending as arc slices
function DonutChart({ breakdown }: { breakdown: { cat: string; pct: number }[] }) {
  if (breakdown.length === 0) return null;
  const cx = 50, cy = 50, R = 40, inner = 26;

  if (breakdown.length === 1) {
    const s = CATS[breakdown[0].cat] ?? CATS.other;
    return (
      <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
        <circle cx={cx} cy={cy} r={R} fill={s.color + "cc"} />
        <circle cx={cx} cy={cy} r={inner} fill="#16112e" />
      </svg>
    );
  }

  let angle = -Math.PI / 2;
  const paths = breakdown.map(({ cat, pct }) => {
    const s = CATS[cat] ?? CATS.other;
    const sweep = Math.max((pct / 100) * 2 * Math.PI, 0.001);
    const end = angle + sweep;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
    const xi1 = cx + inner * Math.cos(end),   yi1 = cy + inner * Math.sin(end);
    const xi2 = cx + inner * Math.cos(angle), yi2 = cy + inner * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${xi1} ${yi1} A${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2}Z`;
    angle = end;
    return { d, color: s.color };
  });

  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color + "cc"} />
      ))}
      <circle cx={cx} cy={cy} r={inner} fill="#16112e" />
    </svg>
  );
}

export default function FinanceClient({ initialMonth, initialBudget, initialExpenses, trend }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [budget, setBudget] = useState(initialBudget);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [loading, setLoading] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState("food");
  const [newAmt, setNewAmt] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [adding, setAdding] = useState(false);

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [closingMonth, setClosingMonth] = useState(false);
  const [closeResult, setCloseResult] = useState<{ success?: boolean; xpEarned?: number; overBudget?: boolean } | null>(null);

  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const remaining = budget ? budget.amount - totalSpent : null;
  const isOver = remaining !== null && remaining < 0;
  const pctUsed = budget ? Math.min(100, (totalSpent / budget.amount) * 100) : 0;

  const catBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const e of expenses) {
      groups[e.category] = (groups[e.category] ?? 0) + e.amount;
    }
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({
        cat,
        amount,
        pct: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }));
  }, [expenses, totalSpent]);

  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

  async function changeMonth(delta: number) {
    const [y, mo] = month.split("-").map(Number);
    const d = new Date(y, mo - 1 + delta, 1);
    const newMonth = d.toISOString().slice(0, 7);
    setLoading(true);
    setCloseResult(null);
    const [bRes, eRes] = await Promise.all([
      fetch(`/api/kakeebo/budget?month=${newMonth}`),
      fetch(`/api/kakeebo/expenses?month=${newMonth}`),
    ]);
    const [bData, eData] = await Promise.all([bRes.json(), eRes.json()]);
    setMonth(newMonth);
    setBudget(bData);
    setExpenses(eData);
    setLoading(false);
  }

  async function saveBudget() {
    const val = parseFloat(budgetInput);
    if (!budgetInput || val <= 0) return;
    setSavingBudget(true);
    const r = await fetch("/api/kakeebo/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, amount: val }),
    });
    if (r.ok) {
      const d = await r.json();
      setBudget(d);
      setEditingBudget(false);
      setBudgetInput("");
    }
    setSavingBudget(false);
  }

  async function addExpense() {
    const val = parseFloat(newAmt);
    if (!newAmt || val <= 0) return;
    setAdding(true);
    const r = await fetch("/api/kakeebo/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: val, category: newCat, description: newDesc || null, date: newDate }),
    });
    if (r.ok) {
      const e = await r.json();
      setExpenses((prev) =>
        [e, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
      setNewAmt("");
      setNewDesc("");
      setShowAdd(false);
    }
    setAdding(false);
  }

  async function deleteExpense(id: string) {
    setDeletingId(id);
    const r = await fetch(`/api/kakeebo/expenses/${id}`, { method: "DELETE" });
    if (r.ok) setExpenses((prev) => prev.filter((e) => e.id !== id));
    setDeletingId(null);
  }

  async function closeMonth() {
    setClosingMonth(true);
    const r = await fetch("/api/kakeebo/close-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const data = await r.json();
    setCloseResult(data);
    if (data.success) {
      setBudget((prev) => prev ? { ...prev, closed: true } : prev);
    }
    setClosingMonth(false);
  }

  const monthLabel = new Date(month + "-15").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const maxTrend = Math.max(...trend.map((t) => Math.max(t.spent, t.budget ?? 0)), 1);

  const trendCurr = trend[trend.length - 1];
  const trendPrev = trend[trend.length - 2];
  const trendDiff = trendCurr && trendPrev ? trendCurr.spent - trendPrev.spent : null;
  const trendPct = trendPrev?.spent > 0 && trendDiff !== null
    ? Math.abs(Math.round((trendDiff / trendPrev.spent) * 100))
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#ede9ff]">💰 Finance</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold active:scale-95 transition-all"
        >
          + Expense
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-[#16112e] rounded-2xl border border-[#3b2d6e] px-4 py-3 mb-4">
        <button
          onClick={() => changeMonth(-1)}
          disabled={loading}
          className="w-9 h-9 flex items-center justify-center text-[#9d8ac7] hover:text-amber-400 rounded-xl hover:bg-[#1e1740] transition-colors disabled:opacity-40 text-lg font-bold"
        >
          ‹
        </button>
        <span className="font-semibold text-[#ede9ff] text-sm">{monthLabel}</span>
        <button
          onClick={() => changeMonth(1)}
          disabled={isCurrentMonth || loading}
          className="w-9 h-9 flex items-center justify-center text-[#9d8ac7] hover:text-amber-400 rounded-xl hover:bg-[#1e1740] transition-colors disabled:opacity-30 text-lg font-bold"
        >
          ›
        </button>
      </div>

      {/* Over-budget alert */}
      {isOver && (
        <div className="bg-red-950/40 border border-red-700/50 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-red-300 font-semibold text-sm">Over budget!</p>
            <p className="text-red-400/70 text-xs">
              You exceeded your budget by €{Math.abs(remaining!).toFixed(2)} this month.
            </p>
          </div>
        </div>
      )}

      {/* Budget card */}
      <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-4">
        {budget ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-[#6b5a9e] uppercase tracking-wider mb-1">Monthly budget</p>
                {editingBudget ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                      placeholder={String(budget.amount)}
                      className="w-28 px-2 py-1.5 rounded-lg bg-[#0f0d22] border border-amber-500/40 text-[#ede9ff] text-sm focus:outline-none"
                    />
                    <button onClick={saveBudget} disabled={savingBudget} className="px-3 py-1.5 bg-amber-500 text-black rounded-lg text-xs font-bold">
                      {savingBudget ? "..." : "Save"}
                    </button>
                    <button onClick={() => setEditingBudget(false)} className="px-3 py-1.5 border border-[#3b2d6e] text-[#9d8ac7] rounded-lg text-xs">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingBudget(true); setBudgetInput(String(budget.amount)); }}
                    className="text-2xl font-bold text-[#ede9ff] hover:text-amber-400 transition-colors"
                  >
                    €{budget.amount.toFixed(0)}
                  </button>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-[#6b5a9e] mb-1">Spent</p>
                <p className={`text-2xl font-bold ${isOver ? "text-red-400" : "text-amber-400"}`}>
                  €{totalSpent.toFixed(0)}
                </p>
              </div>
            </div>

            <div className="h-3 bg-[#0f0d22] rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isOver ? "bg-red-500" : pctUsed > 80 ? "bg-amber-500" : "bg-violet-500"
                }`}
                style={{ width: `${pctUsed}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-[#6b5a9e]">
              <span>{Math.round(pctUsed)}% used</span>
              <span className={remaining! >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                {remaining! >= 0 ? `€${remaining!.toFixed(2)} remaining` : `€${Math.abs(remaining!).toFixed(2)} over`}
              </span>
            </div>

            {/* Proximity warning */}
            {!isOver && pctUsed >= 70 && (
              <p className={`text-xs mt-2 font-medium ${
                pctUsed >= 90 ? "text-red-400" : pctUsed >= 80 ? "text-amber-400" : "text-yellow-500"
              }`}>
                {pctUsed >= 90
                  ? `⚠️ Almost at limit — only €${remaining!.toFixed(2)} left!`
                  : pctUsed >= 80
                    ? `⚡ Over 80% used — €${remaining!.toFixed(2)} remaining`
                    : `💡 70% through budget — €${remaining!.toFixed(2)} left`}
              </p>
            )}
          </>
        ) : (
          <div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs text-[#6b5a9e] uppercase tracking-wider mb-1">No budget set</p>
                <p className="text-2xl font-bold text-amber-400">€{totalSpent.toFixed(0)}</p>
                <p className="text-xs text-[#6b5a9e]">spent this month</p>
              </div>
            </div>
            {editingBudget ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                  placeholder="Monthly budget (€)"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-amber-500/40 text-[#ede9ff] text-sm focus:outline-none"
                />
                <button onClick={saveBudget} disabled={savingBudget} className="px-4 py-2.5 bg-amber-500 text-black rounded-xl text-sm font-bold">
                  {savingBudget ? "..." : "Set"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingBudget(true)}
                className="w-full py-2.5 border border-dashed border-amber-500/40 text-amber-400 rounded-xl text-sm font-medium hover:bg-amber-900/10 transition-colors"
              >
                + Set monthly budget
              </button>
            )}
          </div>
        )}
      </div>

      {/* Close month / reward */}
      {budget && (
        budget.closed || closeResult?.success ? (
          <div className="bg-amber-950/20 border border-amber-700/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <span className="text-2xl">💎</span>
            <div>
              <p className="text-amber-300 font-semibold text-sm">Month closed — budget kept!</p>
              <p className="text-amber-400/70 text-xs">25 XP earned · trophy unlocked</p>
            </div>
          </div>
        ) : (
          <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-4 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#c4b5fd]">🔐 Close this month</p>
                <p className="text-xs text-[#6b5a9e] mt-0.5">
                  Stay within budget → earn 25 XP + a trophy
                </p>
              </div>
              <button
                onClick={closeMonth}
                disabled={closingMonth || isOver}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-500 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
              >
                {closingMonth ? "..." : "Claim"}
              </button>
            </div>
            {closeResult?.overBudget && (
              <p className="text-xs text-red-400 mt-3 bg-red-950/30 border border-red-800/30 px-3 py-2 rounded-xl">
                ⚠️ You&apos;re over budget — get back on track first!
              </p>
            )}
          </div>
        )
      )}

      {/* Category breakdown with donut chart */}
      {catBreakdown.length > 0 && (
        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-4">
          <h2 className="font-semibold text-[#c4b5fd] mb-4 text-sm">📊 By category</h2>
          <div className="flex gap-4 items-center">
            <DonutChart breakdown={catBreakdown} />
            <div className="flex-1 space-y-2.5 min-w-0">
              {catBreakdown.map(({ cat, amount, pct }) => {
                const s = CATS[cat] ?? CATS.other;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-[#ede9ff] text-xs">{s.icon} {s.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6b5a9e]">{Math.round(pct)}%</span>
                        <span className="font-semibold text-xs" style={{ color: s.color }}>
                          €{amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-[#1e1740] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: s.color + "cc" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 6-month trend */}
      <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5 mb-4">
        <h2 className="font-semibold text-[#c4b5fd] mb-3 text-sm">6-month trend</h2>

        {trendDiff !== null && (
          <div
            className={`flex items-center gap-2 text-xs mb-4 px-3 py-2 rounded-xl ${
              trendDiff > 0
                ? "bg-red-950/30 border border-red-800/30 text-red-400"
                : "bg-green-950/30 border border-green-800/30 text-green-400"
            }`}
          >
            <span>{trendDiff > 0 ? "↑" : "↓"}</span>
            <span>
              {trendPct !== null ? `${trendPct}%` : "—"} vs last month —{" "}
              €{Math.abs(trendDiff).toFixed(0)} {trendDiff > 0 ? "more" : "less"} spent
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 h-24 mb-2">
          {trend.map((t) => {
            const height = maxTrend > 0 ? (t.spent / maxTrend) * 96 : 0;
            const isSel = t.month === month;
            return (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full relative" style={{ height: "80px" }}>
                  {t.budget !== null && (
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-amber-500/30"
                      style={{ bottom: `${(t.budget / maxTrend) * 80}px` }}
                    />
                  )}
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-500 ${
                      isSel ? "bg-amber-500" : t.spent > (t.budget ?? Infinity) ? "bg-red-700/70" : "bg-[#3b2d6e]"
                    }`}
                    style={{ height: `${height}px`, minHeight: t.spent > 0 ? "3px" : "0" }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${isSel ? "text-amber-400" : "text-[#4a3a7a]"}`}>
                  {t.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between text-[10px] text-[#4a3a7a] mt-1">
          <span>€0</span>
          <span className="text-[#6b5a9e] text-[9px]">— budget line</span>
          <span>€{maxTrend.toFixed(0)}</span>
        </div>
      </div>

      {/* Expense list */}
      <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-5">
        <h2 className="font-semibold text-[#c4b5fd] mb-4 text-sm">
          🧾 Expenses{" "}
          {expenses.length > 0 && (
            <span className="font-normal text-[#6b5a9e]">({expenses.length})</span>
          )}
        </h2>

        {loading ? (
          <p className="text-[#6b5a9e] text-sm text-center py-4">Loading...</p>
        ) : expenses.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[#6b5a9e] text-sm">No expenses for {monthLabel}</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-3 text-xs text-amber-400 hover:text-amber-300"
            >
              + Add your first expense
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => {
              const s = CATS[e.category] ?? CATS.other;
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 bg-[#0f0d22] rounded-xl px-3 py-2.5 border border-[#2a1f50]"
                >
                  <span className="text-xl flex-shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#ede9ff] truncate">
                      {e.description || s.label}
                    </p>
                    <p className="text-xs text-[#4a3a7a]">
                      {new Date(e.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      {e.merchant && ` · ${e.merchant}`}
                    </p>
                  </div>
                  <span className="font-semibold text-sm flex-shrink-0" style={{ color: s.color }}>
                    -€{e.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => deleteExpense(e.id)}
                    disabled={deletingId === e.id}
                    className="text-[#3b2d6e] hover:text-red-400 transition-colors flex-shrink-0 text-xl leading-none disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add expense bottom sheet */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
          <div className="bg-[#1a1535] rounded-t-2xl border border-[#3b2d6e] w-full max-w-lg px-5 pt-5 pb-8 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-[#ede9ff] mb-4">Add expense</h3>

            <div className="mb-4">
              <label className="block text-xs text-[#9d8ac7] mb-2 uppercase tracking-wider">Category</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(CATS).map(([key, s]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNewCat(key)}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-xs transition-colors ${
                      newCat === key
                        ? "border-amber-500/60 bg-amber-900/20 text-[#ede9ff]"
                        : "border-[#3b2d6e] text-[#6b5a9e] hover:border-[#4a3a7a]"
                    }`}
                  >
                    <span className="text-xl mb-0.5">{s.icon}</span>
                    <span className="leading-tight text-center">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <input
                type="number"
                value={newAmt}
                onChange={(e) => setNewAmt(e.target.value)}
                placeholder="Amount (€)"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] text-[#ede9ff] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 border border-[#3b2d6e] text-[#9d8ac7] rounded-xl text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={addExpense}
                disabled={adding || !newAmt}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
              >
                {adding ? "..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
