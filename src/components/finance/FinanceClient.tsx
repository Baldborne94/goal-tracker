"use client";

import { useState, useMemo, useEffect } from "react";

const ISYBANK_CAT_MAP: Record<string, string> = {
  "ristoranti e bar": "eating_out",
  "bar, caffè e gelaterie": "eating_out",
  "bar, caffe e gelaterie": "eating_out",
  "generi alimentari e supermercato": "groceries",
  "carburanti": "transport",
  "treno, aereo, nave": "transport",
  "taxi/auto a noleggio": "transport",
  "parcheggi e pedaggi": "transport",
  "autobus, tram e metro": "transport",
  "manutenzione auto": "transport",
  "assicurazioni auto": "transport",
  "trasporti": "transport",
  "mobilità": "transport",
  "spese mediche": "health",
  "cura della persona": "health",
  "farmaci e integratori": "health",
  "domiciliazioni e utenze": "utilities",
  "utenze": "utilities",
  "bollette": "utilities",
  "casa varie": "housing",
  "affitto e mutuo": "housing",
  "cellulare": "subscriptions",
  "abbonamenti e streaming": "subscriptions",
  "abbigliamento e accessori": "other",
  "regali": "gifts",
  "viaggi e vacanze": "travel",
  "hotel e alloggi": "travel",
  "cultura e intrattenimento": "culture",
  "hobby": "hobby",
  "istruzione": "culture",
  "addebiti vari": "other",
  "altre uscite": "other",
};

const CATS: Record<string, { icon: string; color: string; label: string }> = {
  groceries:     { icon: "🛒", color: "#f59e0b", label: "Spesa" },
  eating_out:    { icon: "🍽️", color: "#f97316", label: "Ristoranti" },
  transport:     { icon: "🚗", color: "#0ea5e9", label: "Trasporti" },
  housing:       { icon: "🏠", color: "#22c55e", label: "Casa" },
  utilities:     { icon: "💡", color: "#3b82f6", label: "Bollette" },
  health:        { icon: "💊", color: "#ec4899", label: "Salute" },
  subscriptions: { icon: "📱", color: "#6366f1", label: "Abbonamenti" },
  hobby:         { icon: "🎨", color: "#06b6d4", label: "Hobby" },
  culture:       { icon: "🎭", color: "#8b5cf6", label: "Cultura" },
  travel:        { icon: "✈️", color: "#14b8a6", label: "Viaggi" },
  gifts:         { icon: "🎁", color: "#a855f7", label: "Regali" },
  unexpected:    { icon: "⚡", color: "#ef4444", label: "Imprevisti" },
  other:         { icon: "📦", color: "#6b7280", label: "Altro" },
};

type Budget = { id: string; month: string; amount: number; closed?: boolean } | null;
type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  merchant: string | null;
  date: string;
  isRecurring?: boolean;
};
type CatBudget = { id: string; category: string; amount: number };
type TrendPoint = { month: string; label: string; spent: number; budget: number | null };
type RecurringBill = { id: string; title: string; amount: number; dueDay: number; category: string; notifyDaysBefore: number; active: boolean };
type Props = {
  initialMonth: string;
  initialBudget: Budget;
  initialExpenses: Expense[];
  trend: TrendPoint[];
  initialBills?: RecurringBill[];
};

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DonutChart({ breakdown }: { breakdown: { cat: string; pct: number }[] }) {
  if (breakdown.length === 0) return null;
  const cx = 50, cy = 50, R = 40, inner = 26;
  if (breakdown.length === 1) {
    const s = CATS[breakdown[0].cat] ?? CATS.other;
    return (
      <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
        <circle cx={cx} cy={cy} r={R} fill={s.color + "cc"} />
        <circle cx={cx} cy={cy} r={inner} style={{ fill: "var(--theme-bg)" }} />
      </svg>
    );
  }
  let angle = -Math.PI / 2;
  const paths = breakdown.map(({ cat, pct }) => {
    const s = CATS[cat] ?? CATS.other;
    const sweep = Math.max((pct / 100) * 2 * Math.PI, 0.001);
    const end = angle + sweep;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(end), y2 = cy + R * Math.sin(end);
    const xi1 = cx + inner * Math.cos(end), yi1 = cy + inner * Math.sin(end);
    const xi2 = cx + inner * Math.cos(angle), yi2 = cy + inner * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${xi1} ${yi1} A${inner} ${inner} 0 ${large} 0 ${xi2} ${yi2}Z`;
    angle = end;
    return { d, color: s.color };
  });
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0">
      {paths.map((p, i) => <path key={i} d={p.d} fill={p.color + "cc"} />)}
      <circle cx={cx} cy={cy} r={inner} style={{ fill: "var(--theme-bg)" }} />
    </svg>
  );
}

function getDaysUntilDue(dueDay: number): number {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (dueDay >= dayOfMonth) return dueDay - dayOfMonth;
  return (daysInMonth - dayOfMonth) + dueDay;
}

function ordinal(n: number) {
  return `${n}°`;
}

export default function FinanceClient({ initialMonth, initialBudget, initialExpenses, trend, initialBills = [] }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [budget, setBudget] = useState(initialBudget);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [loading, setLoading] = useState(false);

  // Unified add/edit form
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formId, setFormId] = useState<string | null>(null);
  const [formCat, setFormCat] = useState("groceries");
  const [formAmt, setFormAmt] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState(() => toDateKey(new Date()));
  const [formSaving, setFormSaving] = useState(false);

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingMonth, setClearingMonth] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [closingMonth, setClosingMonth] = useState(false);
  const [closeResult, setCloseResult] = useState<{ success?: boolean } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvRows, setCsvRows] = useState<{ date: string; amount: number; category: string; description: string; merchant?: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(0);
  const [formRecurring, setFormRecurring] = useState(false);
  const [catBudgets, setCatBudgets] = useState<CatBudget[]>([]);
  const [editingCatBudget, setEditingCatBudget] = useState<string | null>(null);
  const [catBudgetInput, setCatBudgetInput] = useState("");

  // Recurring bills
  const [bills, setBills] = useState<RecurringBill[]>(initialBills);
  const [showBillForm, setShowBillForm] = useState(false);
  const [billFormTitle, setBillFormTitle] = useState("");
  const [billFormAmount, setBillFormAmount] = useState("");
  const [billFormCat, setBillFormCat] = useState("utilities");
  const [billFormDueDay, setBillFormDueDay] = useState(1);
  const [billFormNotify, setBillFormNotify] = useState(3);
  const [savingBill, setSavingBill] = useState(false);
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/kakeebo/category-budget?month=${month}`)
      .then(r => r.ok ? r.json() : [])
      .then(setCatBudgets)
      .catch(() => {});
  }, [month]);

  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const remaining = budget ? budget.amount - totalSpent : null;
  const isOver = remaining !== null && remaining < 0;
  const pctUsed = budget ? Math.min(100, (totalSpent / budget.amount) * 100) : 0;

  const catBreakdown = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const e of expenses) groups[e.category] = (groups[e.category] ?? 0) + e.amount;
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({ cat, amount, pct: totalSpent > 0 ? (amount / totalSpent) * 100 : 0 }));
  }, [expenses, totalSpent]);

  const now = new Date();
  const isCurrentMonth = month === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isLastDayOfMonth = isCurrentMonth && now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const insights = useMemo(() => {
    if (expenses.length === 0) return null;
    const daysInMonth = (() => {
      const [y, m] = month.split("-").map(Number);
      return new Date(y, m, 0).getDate();
    })();
    const safeElapsed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
    const avgPerDay = totalSpent / safeElapsed;
    const projected = isCurrentMonth ? avgPerDay * daysInMonth : null;
    const biggest = expenses.reduce((max, e) => e.amount > max.amount ? e : max, expenses[0]);
    const activeDays = new Set(expenses.map(e => e.date.slice(0, 10))).size;
    return { avgPerDay, projected, biggest, activeDays, daysInMonth, daysElapsed: safeElapsed };
  }, [expenses, totalSpent, isCurrentMonth, month, now]);

  const dailyLeft = useMemo(() => {
    if (!budget || remaining === null || remaining <= 0 || !isCurrentMonth) return null;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
    return { amount: remaining / daysLeft, daysLeft };
  }, [budget, remaining, isCurrentMonth, now]);

  function openBillForm(prefill?: { title?: string; amount?: number; category?: string }) {
    setBillFormTitle(prefill?.title ?? "");
    setBillFormAmount(prefill?.amount ? String(prefill.amount) : "");
    setBillFormCat(prefill?.category ?? "utilities");
    setBillFormDueDay(1);
    setBillFormNotify(3);
    setShowBillForm(true);
  }

  async function saveBill() {
    const val = parseFloat(billFormAmount);
    if (!billFormTitle.trim() || !billFormAmount || val <= 0) return;
    setSavingBill(true);
    const r = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: billFormTitle.trim(), amount: val, dueDay: billFormDueDay, category: billFormCat, notifyDaysBefore: billFormNotify }),
    });
    if (r.ok) {
      const bill = await r.json();
      setBills(prev => [...prev, bill].sort((a, b) => a.dueDay - b.dueDay));
      setShowBillForm(false);
    }
    setSavingBill(false);
  }

  async function deleteBill(id: string) {
    setDeletingBillId(id);
    const r = await fetch(`/api/bills/${id}`, { method: "DELETE" });
    if (r.ok) setBills(prev => prev.filter(b => b.id !== id));
    setDeletingBillId(null);
  }

  async function toggleBillActive(id: string, active: boolean) {
    const r = await fetch(`/api/bills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (r.ok) {
      const updated = await r.json();
      setBills(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b));
    }
  }

  function openAdd() {
    setFormMode("add");
    setFormId(null);
    setFormCat("groceries");
    setFormAmt("");
    setFormDesc("");
    setFormDate(toDateKey(new Date()));
    setFormRecurring(false);
    setShowForm(true);
  }

  function openEdit(e: Expense) {
    setFormMode("edit");
    setFormId(e.id);
    setFormCat(e.category);
    setFormAmt(String(e.amount));
    setFormDesc(e.description ?? "");
    setFormDate(e.date.slice(0, 10));
    setFormRecurring(e.isRecurring ?? false);
    setShowForm(true);
  }

  function exportCsv() {
    const rows = [
      ["Date", "Amount", "Category", "Description", "Merchant", "Recurring"],
      ...expenses.map(e => [
        e.date.slice(0, 10),
        e.amount.toFixed(2),
        CATS[e.category]?.label ?? e.category,
        e.description ?? "",
        e.merchant ?? "",
        e.isRecurring ? "yes" : "no",
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveCatBudget(category: string) {
    const val = parseFloat(catBudgetInput);
    if (!catBudgetInput || val <= 0) { setEditingCatBudget(null); return; }
    const r = await fetch("/api/kakeebo/category-budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, category, amount: val }),
    });
    if (r.ok) {
      const d = await r.json();
      setCatBudgets(prev => {
        const filtered = prev.filter(b => b.category !== category);
        return [...filtered, d];
      });
    }
    setEditingCatBudget(null);
    setCatBudgetInput("");
  }

  async function deleteCatBudget(category: string) {
    await fetch("/api/kakeebo/category-budget", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, category }),
    });
    setCatBudgets(prev => prev.filter(b => b.category !== category));
  }

  async function submitForm() {
    const val = parseFloat(formAmt);
    if (!formAmt || val <= 0) return;
    setFormSaving(true);
    if (formMode === "add") {
      const r = await fetch("/api/kakeebo/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val, category: formCat, description: formDesc || null, date: formDate, isRecurring: formRecurring }),
      });
      if (r.ok) {
        const e = await r.json();
        setExpenses(prev => [e, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setShowForm(false);
      }
    } else {
      const r = await fetch(`/api/kakeebo/expenses/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: val, category: formCat, description: formDesc || null, date: formDate, isRecurring: formRecurring }),
      });
      if (r.ok) {
        const updated = await r.json();
        setExpenses(prev =>
          prev.map(e => e.id === updated.id ? { ...e, ...updated } : e)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
        setShowForm(false);
      }
    }
    setFormSaving(false);
  }

  async function changeMonth(delta: number) {
    const [y, mo] = month.split("-").map(Number);
    const d = new Date(y, mo - 1 + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
    setFilterCat(null);
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

  async function deleteExpense(id: string) {
    setDeletingId(id);
    const r = await fetch(`/api/kakeebo/expenses/${id}`, { method: "DELETE" });
    if (r.ok) setExpenses(prev => prev.filter(e => e.id !== id));
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
    if (data.success) setBudget(prev => prev ? { ...prev, closed: true } : prev);
    setClosingMonth(false);
  }

  async function clearMonth() {
    setClearingMonth(true);
    const r = await fetch(`/api/kakeebo/expenses?month=${month}`, { method: "DELETE" });
    if (r.ok) {
      setExpenses([]);
      setCloseResult(null);
    }
    setClearingMonth(false);
    setShowClearConfirm(false);
  }

  function parseCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? "";
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes("date") || firstLine.includes("amount") || firstLine.includes("categoria");
      const dataLines = hasHeader ? lines.slice(1) : lines;
      const KNOWN_CATS = Object.keys(CATS);
      const rows = dataLines
        .map(line => {
          const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ""));
          const [rawDate, rawAmount, rawCat, rawDesc] = parts;
          const amount = parseFloat(rawAmount);
          if (!rawDate || isNaN(amount) || amount <= 0) return null;
          const date = rawDate.includes("/") ? rawDate.split("/").reverse().join("-") : rawDate;
          const category = KNOWN_CATS.includes(rawCat?.toLowerCase()) ? rawCat.toLowerCase() : "other";
          return { date, amount, category, description: rawDesc ?? "" };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      setCsvRows(rows);
      setImportDone(0);
      setShowImport(true);
    };
    reader.readAsText(file);
  }

  async function parseExcelFile(file: File) {
    const { read, utils } = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = read(buffer, { type: "array" });
    const sheet = wb.Sheets["Lista Operazioni"] ?? wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return;
    // Row 1-2: metadata, row 3: headers, row 4+: data
    const raw: string[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
    // Find header row (contains "Tipologia")
    const headerIdx = raw.findIndex(r => r.some(c => String(c).trim() === "Tipologia"));
    if (headerIdx < 0) return;
    const headers = raw[headerIdx].map(h => String(h).trim());
    const iType = headers.indexOf("Tipologia");
    const iCat = headers.indexOf("Dettaglio Categoria");
    const iDate = headers.indexOf("Data");
    const iOp = headers.indexOf("Operazione");
    const iImporto = headers.indexOf("Importo");
    const rows = raw.slice(headerIdx + 1)
      .map(r => {
        const tipo = String(r[iType] ?? "").trim();
        if (tipo !== "Uscite") return null;
        const importo = parseFloat(String(r[iImporto] ?? "").replace(",", "."));
        if (isNaN(importo) || importo >= 0) return null;
        const amount = Math.abs(importo);
        const rawDate = String(r[iDate] ?? "").trim(); // dd/MM/yyyy
        const parts = rawDate.split("/");
        const date = parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}` : rawDate;
        const detCat = String(r[iCat] ?? "").trim().toLowerCase();
        const category = ISYBANK_CAT_MAP[detCat] ?? "other";
        const merchant = String(r[iOp] ?? "").trim() || undefined;
        return { date, amount, category, description: merchant ?? "", merchant };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    setCsvRows(rows);
    setImportDone(0);
    setShowImport(true);
  }

  async function confirmImport() {
    setImporting(true);
    let done = 0;
    for (const row of csvRows) {
      const r = await fetch("/api/kakeebo/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
      if (r.ok) {
        const e = await r.json();
        setExpenses(prev => [e, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        done++;
        setImportDone(done);
      }
    }
    setImporting(false);
    setCsvRows([]);
    setShowImport(false);
  }

  const monthLabel = new Date(month + "-15").toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const maxTrend = Math.max(...trend.map(t => Math.max(t.spent, t.budget ?? 0)), 1);
  const trendCurr = trend[trend.length - 1];
  const trendPrev = trend[trend.length - 2];
  const trendDiff = trendCurr && trendPrev ? trendCurr.spent - trendPrev.spent : null;
  const trendPct = trendPrev?.spent > 0 && trendDiff !== null ? Math.abs(Math.round((trendDiff / trendPrev.spent) * 100)) : null;

  const inputStyle = { background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" };
  const inputCls = "w-full px-3 py-2.5 rounded-xl text-[#ede9ff] placeholder-[#4a3a7a] text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 border";

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#ede9ff]">💰 Finanze</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          {expenses.length > 0 && (
            <button onClick={exportCsv} className="px-3 py-2 rounded-xl text-sm font-medium active:scale-95 transition-all border" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>
              ⬇️ CSV
            </button>
          )}
          <label className="px-3 py-2 rounded-xl text-sm font-medium cursor-pointer active:scale-95 transition-all border" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>
            📊 ISYbank
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => e.target.files?.[0] && parseExcelFile(e.target.files[0])} />
          </label>
          <button onClick={openAdd} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold active:scale-95 transition-all">
            + Spesa
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between rounded-2xl border px-4 py-3 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <button onClick={() => changeMonth(-1)} disabled={loading} className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold disabled:opacity-40 transition-colors" style={{ color: "var(--theme-text-muted)" }}>‹</button>
        <span className="font-semibold text-[#ede9ff] text-sm">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} disabled={isCurrentMonth || loading} className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold disabled:opacity-30 transition-colors" style={{ color: "var(--theme-text-muted)" }}>›</button>
      </div>

      {/* Over-budget alert */}
      {isOver && (
        <div className="bg-red-950/40 border border-red-700/50 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-red-300 font-semibold text-sm">Budget superato!</p>
            <p className="text-red-400/70 text-xs">Sforato di €{Math.abs(remaining!).toFixed(2)} questo mese.</p>
          </div>
        </div>
      )}

      {/* Budget card */}
      <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        {budget ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--theme-text-muted)" }}>Budget mensile</p>
                {editingBudget ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={budgetInput}
                      onChange={e => setBudgetInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveBudget()}
                      placeholder={String(budget.amount)}
                      className="w-28 px-2 py-1.5 rounded-lg text-[#ede9ff] text-sm focus:outline-none border border-amber-500/40"
                      style={{ background: "var(--theme-bg)" }}
                    />
                    <button onClick={saveBudget} disabled={savingBudget} className="px-3 py-1.5 bg-amber-500 text-black rounded-lg text-xs font-bold">{savingBudget ? "..." : "Salva"}</button>
                    <button onClick={() => setEditingBudget(false)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingBudget(true); setBudgetInput(String(budget.amount)); }} className="text-2xl font-bold text-[#ede9ff] hover:text-amber-400 transition-colors">
                    €{budget.amount.toFixed(2)}
                  </button>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs mb-1" style={{ color: "var(--theme-text-muted)" }}>Speso</p>
                <p className={`text-2xl font-bold ${isOver ? "text-red-400" : "text-amber-400"}`}>€{totalSpent.toFixed(2)}</p>
              </div>
            </div>

            <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: "var(--theme-bg)" }}>
              <div
                className={`h-full rounded-full transition-all duration-700 ${isOver ? "bg-red-500" : pctUsed > 80 ? "bg-amber-500" : "bg-violet-500"}`}
                style={{ width: `${pctUsed}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mb-3" style={{ color: "var(--theme-text-muted)" }}>
              <span>{Math.round(pctUsed)}% usato</span>
              <span className={remaining! >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                {remaining! >= 0 ? `€${remaining!.toFixed(2)} rimanenti` : `€${Math.abs(remaining!).toFixed(2)} in eccesso`}
              </span>
            </div>

            {/* Daily budget + projection */}
            {dailyLeft && (
              <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--theme-bg)" }}>
                <div>
                  <p className="text-sm font-bold text-[#ede9ff]">€{dailyLeft.amount.toFixed(2)}<span className="text-xs font-normal">/giorno</span></p>
                  <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{dailyLeft.daysLeft} giorni rimanenti nel mese</p>
                </div>
                {insights?.projected !== undefined && insights.projected !== null && (
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${insights.projected > budget.amount ? "text-red-400" : "text-green-400"}`}>
                      ~€{insights.projected.toFixed(2)} previsto
                    </p>
                    <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>stima fine mese</p>
                  </div>
                )}
              </div>
            )}

            {!isOver && pctUsed >= 70 && (
              <p className={`text-xs mt-2 font-medium ${pctUsed >= 90 ? "text-red-400" : pctUsed >= 80 ? "text-amber-400" : "text-yellow-500"}`}>
                {pctUsed >= 90 ? `⚠️ Quasi al limite — €${remaining!.toFixed(2)} rimasti!` : pctUsed >= 80 ? `⚡ Oltre l'80% usato — €${remaining!.toFixed(2)} rimanenti` : `💡 70% del budget consumato — €${remaining!.toFixed(2)} rimasti`}
              </p>
            )}
          </>
        ) : (
          <div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--theme-text-muted)" }}>Nessun budget impostato</p>
                <p className="text-2xl font-bold text-amber-400">€{totalSpent.toFixed(2)}</p>
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>speso questo mese</p>
              </div>
            </div>
            {editingBudget ? (
              <div className="flex gap-2">
                <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveBudget()} placeholder="Budget mensile (€)" className={inputCls} style={inputStyle} />
                <button onClick={saveBudget} disabled={savingBudget} className="px-4 py-2.5 bg-amber-500 text-black rounded-xl text-sm font-bold">{savingBudget ? "..." : "Imposta"}</button>
              </div>
            ) : (
              <button onClick={() => setEditingBudget(true)} className="w-full py-2.5 border border-dashed border-amber-500/40 text-amber-400 rounded-xl text-sm font-medium hover:bg-amber-900/10 transition-colors">
                + Imposta budget mensile
              </button>
            )}
          </div>
        )}
      </div>

      {/* Insights strip */}
      {insights && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: "📅", label: "Media/giorno", value: `€${insights.avgPerDay.toFixed(2)}` },
            { icon: CATS[insights.biggest.category]?.icon ?? "📦", label: "Maggiore", value: `€${insights.biggest.amount.toFixed(2)}` },
            { icon: "🗓", label: "Giorni attivi", value: `${insights.activeDays}/${insights.daysInMonth}` },
          ].map(card => (
            <div key={card.label} className="rounded-xl border p-3 text-center" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
              <div className="text-lg mb-0.5">{card.icon}</div>
              <div className="text-sm font-bold text-[#ede9ff]">{card.value}</div>
              <div className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Close month / reward */}
      {budget && (
        budget.closed || closeResult?.success ? (
          <div className="bg-amber-950/20 border border-amber-700/30 rounded-2xl p-4 mb-4 flex items-center gap-3">
            <span className="text-2xl">💎</span>
            <div>
              <p className="text-amber-300 font-semibold text-sm">Mese chiuso — budget rispettato!</p>
              <p className="text-amber-400/70 text-xs">25 XP guadagnati · trofeo sbloccato</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border p-4 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            {isLastDayOfMonth && !isOver && (
              <div className="mb-3 bg-amber-950/30 border border-amber-600/40 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <p className="text-xs text-amber-300 font-medium">Oggi è l'ultimo giorno — riscatta la tua ricompensa prima di mezzanotte!</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#c4b5fd]">🔐 Chiudi questo mese</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--theme-text-muted)" }}>Rimani nel budget → guadagna 25 XP + un trofeo</p>
              </div>
              <button onClick={closeMonth} disabled={closingMonth || isOver} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-500 text-white rounded-xl text-sm font-bold disabled:opacity-40 active:scale-95 transition-all flex-shrink-0">
                {closingMonth ? "..." : "Riscatta"}
              </button>
            </div>
            {isOver && (
              <p className="text-xs text-red-400 mt-3 bg-red-950/30 border border-red-800/30 px-3 py-2 rounded-xl">⚠️ Hai sforato il budget — riduci le spese per sbloccare.</p>
            )}
          </div>
        )
      )}

      {/* Recurring bills */}
      <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#c4b5fd] text-sm">📌 Pagamenti fissi</h2>
          <button
            onClick={() => openBillForm()}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black active:scale-95 transition-all"
          >
            + Aggiungi
          </button>
        </div>

        {bills.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--theme-text-muted)" }}>
            Nessun pagamento fisso — aggiungi affitto, bollette, abbonamenti, ecc.
          </p>
        ) : (
          <div className="space-y-2">
            {bills.map(bill => {
              const s = CATS[bill.category] ?? CATS.other;
              const daysUntil = getDaysUntilDue(bill.dueDay);
              const badgeColor = daysUntil <= 3 ? "text-red-400 bg-red-950/40 border-red-700/40" : daysUntil <= 7 ? "text-amber-400 bg-amber-950/30 border-amber-700/30" : "text-green-400 bg-green-950/30 border-green-700/30";
              return (
                <div key={bill.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${!bill.active ? "opacity-50" : ""}`} style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}>
                  <span className="text-xl flex-shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#ede9ff] truncate">{bill.title}</p>
                    <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Ogni {ordinal(bill.dueDay)} del mese · avviso {bill.notifyDaysBefore}gg prima</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${badgeColor}`}>
                    {daysUntil === 0 ? "oggi" : `${daysUntil}gg`}
                  </span>
                  <span className="font-semibold text-sm flex-shrink-0" style={{ color: s.color }}>€{bill.amount.toFixed(2)}</span>
                  <button
                    onClick={() => toggleBillActive(bill.id, !bill.active)}
                    className="text-sm flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border transition-colors"
                    style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                    title={bill.active ? "Metti in pausa" : "Attiva pagamento"}
                  >
                    {bill.active ? "⏸" : "▶"}
                  </button>
                  <button
                    onClick={() => deleteBill(bill.id)}
                    disabled={deletingBillId === bill.id}
                    className="text-xl leading-none flex-shrink-0 disabled:opacity-40 hover:text-red-400 transition-colors"
                    style={{ color: "var(--theme-surface-border)" }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {catBreakdown.length > 0 && (
        <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <h2 className="font-semibold text-[#c4b5fd] mb-4 text-sm">📊 Per categoria</h2>
          <div className="flex gap-4 items-center">
            <DonutChart breakdown={catBreakdown} />
            <div className="flex-1 space-y-2.5 min-w-0">
              {catBreakdown.map(({ cat, amount, pct }) => {
                const s = CATS[cat] ?? CATS.other;
                const catLimit = catBudgets.find(b => b.category === cat);
                const limitPct = catLimit ? Math.min(100, (amount / catLimit.amount) * 100) : null;
                const overCatBudget = catLimit && amount > catLimit.amount;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#ede9ff]">{s.icon} {s.label}</span>
                      <div className="flex items-center gap-1.5">
                        {catLimit && (
                          <span className={`text-xs font-medium ${overCatBudget ? "text-red-400" : "text-green-400"}`}>
                            {overCatBudget ? "⚠️" : ""} €{amount.toFixed(2)}/€{catLimit.amount.toFixed(2)}
                          </span>
                        )}
                        {!catLimit && <span className="font-semibold text-xs" style={{ color: s.color }}>€{amount.toFixed(2)}</span>}
                        {editingCatBudget === cat ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={catBudgetInput}
                              onChange={e => setCatBudgetInput(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") saveCatBudget(cat); if (e.key === "Escape") setEditingCatBudget(null); }}
                              placeholder="limite"
                              autoFocus
                              className="w-16 px-1.5 py-0.5 rounded-lg text-xs text-[#ede9ff] border border-amber-500/40 focus:outline-none"
                              style={{ background: "var(--theme-bg)" }}
                            />
                            <button onClick={() => saveCatBudget(cat)} className="text-xs text-amber-400">✓</button>
                            <button onClick={() => setEditingCatBudget(null)} className="text-xs" style={{ color: "var(--theme-text-muted)" }}>✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingCatBudget(cat); setCatBudgetInput(catLimit ? String(catLimit.amount) : ""); }}
                            className="text-[10px] px-1.5 py-0.5 rounded-md border transition-colors"
                            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                          >
                            {catLimit ? "✏️" : "+ limite"}
                          </button>
                        )}
                        {catLimit && editingCatBudget !== cat && (
                          <button onClick={() => deleteCatBudget(cat)} className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>×</button>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--theme-bg)" }}>
                      {limitPct !== null ? (
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${limitPct}%`, backgroundColor: overCatBudget ? "#ef4444cc" : limitPct > 80 ? "#f59e0bcc" : s.color + "cc" }} />
                      ) : (
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color + "cc" }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 12-month trend */}
      <div className="rounded-2xl border p-5 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <h2 className="font-semibold text-[#c4b5fd] mb-3 text-sm">📈 Trend 12 mesi</h2>
        {trendDiff !== null && (
          <div className={`flex items-center gap-2 text-xs mb-4 px-3 py-2 rounded-xl ${trendDiff > 0 ? "bg-red-950/30 border border-red-800/30 text-red-400" : "bg-green-950/30 border border-green-800/30 text-green-400"}`}>
            <span>{trendDiff > 0 ? "↑" : "↓"}</span>
            <span>
              {trendDiff > 0 ? "Speso" : "Risparmiato"} €{Math.abs(trendDiff).toFixed(2)} {trendDiff > 0 ? "in più" : "in meno"} rispetto al mese scorso
              {trendPct !== null ? ` · ${trendPct}% ${trendDiff > 0 ? "in più" : "in meno"}` : ""}
            </span>
          </div>
        )}
        <div className="flex items-end gap-1 mb-2" style={{ height: "96px" }}>
          {trend.map(t => {
            const height = maxTrend > 0 ? (t.spent / maxTrend) * 80 : 0;
            const isSel = t.month === month;
            return (
              <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full relative" style={{ height: "80px" }}>
                  {t.budget !== null && (
                    <div className="absolute left-0 right-0 border-t border-dashed border-amber-500/30" style={{ bottom: `${(t.budget / maxTrend) * 80}px` }} />
                  )}
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-t-sm transition-all duration-500`}
                    style={{
                      height: `${height}px`,
                      minHeight: t.spent > 0 ? "3px" : "0",
                      background: isSel ? "#f59e0b" : t.spent > (t.budget ?? Infinity) ? "rgba(185,28,28,0.7)" : "var(--theme-surface-border)",
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium" style={{ color: isSel ? "#f59e0b" : "var(--theme-text-muted)" }}>{t.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px]" style={{ color: "var(--theme-text-muted)" }}>
          <span>€0</span>
          <span style={{ fontSize: "9px" }}>— linea budget</span>
          <span>€{maxTrend.toFixed(2)}</span>
        </div>
      </div>

      {/* Daily expense log */}
      <div className="rounded-2xl border p-5" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#c4b5fd] text-sm">
            🧾 Registro giornaliero{" "}
            {expenses.length > 0 && <span className="font-normal" style={{ color: "var(--theme-text-muted)" }}>({expenses.length})</span>}
          </h2>
          <div className="flex items-center gap-2">
            {expenses.length > 0 && (
              <span className="text-xs font-bold text-amber-400">-€{totalSpent.toFixed(2)}</span>
            )}
            {expenses.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-xs px-2 py-1 rounded-lg border transition-colors"
                style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
              >
                🗑️ Cancella
              </button>
            )}
          </div>
        </div>

        {/* Category filter chips */}
        {expenses.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setFilterCat(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterCat === null ? "border-amber-500/60 bg-amber-900/20 text-amber-400" : ""}`}
              style={filterCat !== null ? { borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" } : {}}
            >
              Tutto
            </button>
            {catBreakdown.map(({ cat }) => {
              const s = CATS[cat] ?? CATS.other;
              const active = filterCat === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCat(active ? null : cat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "border-amber-500/60 bg-amber-900/20 text-amber-400" : ""}`}
                  style={active ? {} : { borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                >
                  {s.icon} {s.label}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--theme-text-muted)" }}>Caricamento...</p>
        ) : expenses.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm mb-3" style={{ color: "var(--theme-text-muted)" }}>Nessuna spesa per {monthLabel}</p>
            <button onClick={openAdd} className="text-xs text-amber-400 hover:text-amber-300">+ Aggiungi la prima spesa</button>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              const filtered = filterCat ? expenses.filter(e => e.category === filterCat) : expenses;
              const todayKey = toDateKey(new Date());
              const yestDate = new Date(); yestDate.setDate(yestDate.getDate() - 1);
              const yesterKey = toDateKey(yestDate);
              const byDay: { dateKey: string; label: string; total: number; items: typeof expenses }[] = [];
              for (const e of filtered) {
                const dateKey = e.date.slice(0, 10);
                const existing = byDay.find(d => d.dateKey === dateKey);
                if (existing) { existing.items.push(e); existing.total += e.amount; }
                else {
                  const d = new Date(dateKey + "T12:00:00");
                  const label = dateKey === todayKey ? "Oggi" : dateKey === yesterKey ? "Ieri" : d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
                  byDay.push({ dateKey, label, total: e.amount, items: [e] });
                }
              }
              return byDay.map(({ dateKey, label, total, items }) => (
                <div key={dateKey}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--theme-text-muted)" }}>{label}</span>
                    <span className="text-xs font-bold text-amber-400">-€{total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(e => {
                      const s = CATS[e.category] ?? CATS.other;
                      return (
                        <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border" style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}>
                          <span className="text-xl flex-shrink-0">{s.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#ede9ff] truncate">
                              {e.description || s.label}
                              {e.isRecurring && <span className="ml-1 text-[10px] text-amber-400/70">🔄</span>}
                            </p>
                            {e.merchant && <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{e.merchant}</p>}
                          </div>
                          <span className="font-semibold text-sm flex-shrink-0" style={{ color: s.color }}>-€{e.amount.toFixed(2)}</span>
                          <button
                            onClick={() => openEdit(e)}
                            className="text-xs flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => openBillForm({ title: e.description ?? undefined, amount: e.amount, category: e.category })}
                            className="text-xs flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border transition-colors"
                            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                            title="Fissa come pagamento ricorrente"
                          >
                            📌
                          </button>
                          <button
                            onClick={() => deleteExpense(e.id)}
                            disabled={deletingId === e.id}
                            className="text-xl leading-none flex-shrink-0 disabled:opacity-40 hover:text-red-400 transition-colors"
                            style={{ color: "var(--theme-surface-border)" }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {/* Clear month confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] px-4">
          <div className="rounded-2xl border w-full max-w-sm p-6" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <h3 className="font-bold text-[#ede9ff] mb-2">🗑️ Cancella {monthLabel}?</h3>
            <p className="text-sm mb-5" style={{ color: "var(--theme-text-muted)" }}>
              Questo eliminerà definitivamente tutte le {expenses.length} spese di questo mese. Non può essere annullato.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearConfirm(false)} disabled={clearingMonth} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50" style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>Annulla</button>
              <button onClick={clearMonth} disabled={clearingMonth} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all">
                {clearingMonth ? "Cancellando..." : "Elimina tutto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV import modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[60]">
          <div className="rounded-t-2xl border w-full max-w-lg px-5 pt-5 pb-20 max-h-[80vh] overflow-y-auto" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <h3 className="font-bold text-[#ede9ff] mb-1">📥 Importa da CSV</h3>
            <p className="text-xs mb-4" style={{ color: "var(--theme-text-muted)" }}>{csvRows.length} righe — controlla prima di importare</p>
            {csvRows.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--theme-text-muted)" }}>Nessuna riga valida. Formato: <code className="text-amber-400">data,importo,categoria,descrizione</code></p>
            ) : (
              <div className="space-y-1.5 mb-4 max-h-52 overflow-y-auto">
                {csvRows.map((row, i) => {
                  const s = CATS[row.category] ?? CATS.other;
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2 border" style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}>
                      <span className="text-lg flex-shrink-0">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#ede9ff] truncate">{row.description || s.label}</p>
                        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{row.date}</p>
                      </div>
                      <span className="font-semibold text-xs flex-shrink-0" style={{ color: s.color }}>-€{row.amount.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {importing && <p className="text-xs text-amber-400 text-center mb-3">Importando {importDone}/{csvRows.length}...</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowImport(false); setCsvRows([]); }} disabled={importing} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50" style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>Annulla</button>
              <button onClick={confirmImport} disabled={importing || csvRows.length === 0} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95">
                {importing ? `${importDone}/${csvRows.length}...` : `Importa ${csvRows.length}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add bill bottom sheet */}
      {showBillForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[60]">
          <div className="rounded-t-2xl border w-full max-w-lg px-5 pt-5 pb-20 max-h-[90vh] overflow-y-auto" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <h3 className="font-bold text-[#ede9ff] mb-4">📌 Aggiungi pagamento fisso</h3>

            <div className="space-y-3 mb-4">
              <input
                value={billFormTitle}
                onChange={e => setBillFormTitle(e.target.value)}
                placeholder="Nome (es. Affitto, Netflix, Rata auto)"
                className={inputCls}
                style={inputStyle}
              />
              <input
                type="number"
                value={billFormAmount}
                onChange={e => setBillFormAmount(e.target.value)}
                placeholder="Importo (€)"
                min="0"
                step="0.01"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: "var(--theme-text-muted)" }}>Categoria</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(CATS).map(([key, s]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBillFormCat(key)}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-xs transition-colors ${billFormCat === key ? "border-amber-500/60 bg-amber-900/20 text-[#ede9ff]" : ""}`}
                    style={billFormCat === key ? {} : { borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                  >
                    <span className="text-xl mb-0.5">{s.icon}</span>
                    <span className="leading-tight text-center">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-4 mb-4 space-y-4" style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs uppercase tracking-wider" style={{ color: "var(--theme-text-muted)" }}>Giorno di scadenza</label>
                  <span className="text-sm font-bold text-amber-400">{ordinal(billFormDueDay)}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={28}
                  value={billFormDueDay}
                  onChange={e => setBillFormDueDay(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--theme-text-muted)" }}>
                  <span>1°</span><span>15°</span><span>28°</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs uppercase tracking-wider" style={{ color: "var(--theme-text-muted)" }}>Avviso giorni prima</label>
                  <span className="text-sm font-bold text-amber-400">{billFormNotify} giorn{billFormNotify !== 1 ? "i" : "o"}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={billFormNotify}
                  onChange={e => setBillFormNotify(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--theme-text-muted)" }}>
                  <span>1 giorno</span><span>4 giorni</span><span>7 giorni</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowBillForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>Annulla</button>
              <button onClick={saveBill} disabled={savingBill || !billFormTitle.trim() || !billFormAmount} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all">
                {savingBill ? "..." : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit expense bottom sheet */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[60]">
          <div className="rounded-t-2xl border w-full max-w-lg px-5 pt-5 pb-20 max-h-[90vh] overflow-y-auto" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
            <h3 className="font-bold text-[#ede9ff] mb-4">{formMode === "add" ? "Aggiungi spesa" : "Modifica spesa"}</h3>

            <div className="mb-4">
              <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: "var(--theme-text-muted)" }}>Categoria</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(CATS).map(([key, s]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormCat(key)}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-xs transition-colors ${formCat === key ? "border-amber-500/60 bg-amber-900/20 text-[#ede9ff]" : ""}`}
                    style={formCat === key ? {} : { borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                  >
                    <span className="text-xl mb-0.5">{s.icon}</span>
                    <span className="leading-tight text-center">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <input type="number" value={formAmt} onChange={e => setFormAmt(e.target.value)} placeholder="Importo (€)" min="0" step="0.01" className={inputCls} style={inputStyle} />
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Descrizione (opzionale)" className={inputCls} style={inputStyle} />
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={inputCls} style={inputStyle} />
            </div>

            <button
              type="button"
              onClick={() => setFormRecurring(!formRecurring)}
              className="flex items-center justify-between w-full mb-4 rounded-xl border px-3 py-2.5"
              style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🔄</span>
                <div className="text-left">
                  <p className="text-xs font-medium text-[#ede9ff]">Ricorrente mensile</p>
                  <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>Copia automatica al mese successivo</p>
                </div>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${formRecurring ? "bg-amber-500" : "bg-[#3b2d6e]"}`}>
                <div className={`w-4 h-4 rounded-full bg-white m-0.5 transition-transform ${formRecurring ? "translate-x-4" : "translate-x-0"}`} />
              </div>
            </button>

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>Annulla</button>
              <button onClick={submitForm} disabled={formSaving || !formAmt} className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all">
                {formSaving ? "..." : formMode === "add" ? "Aggiungi" : "Salva modifiche"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
