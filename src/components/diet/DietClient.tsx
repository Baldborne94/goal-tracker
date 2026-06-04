"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { FOODS, type FoodItem } from "@/lib/foods";

type BarcodeProduct = {
  name: string; brand: string; kcalPer100g: number;
  proteins: number; carbs: number; fat: number; fiber: number;
  ingredients: string; imageUrl: string;
};

const MEALS = [
  { type: "breakfast",  icon: "🌅", label: "Breakfast",        time: "08:00" },
  { type: "snack_am",   icon: "🍎", label: "Morning snack",    time: "10:30" },
  { type: "lunch",      icon: "☀️",  label: "Lunch",            time: "13:00" },
  { type: "snack_pm",   icon: "🍊", label: "Afternoon snack",  time: "16:30" },
  { type: "dinner",     icon: "🌙", label: "Dinner",           time: "20:00" },
];

const DAILY_TARGET = 2000;

type MealLog = { id: string; date: string; mealType: string; text: string; notes: string | null };
type WeightEntry = { id: string; weight: number; date: string };
type FoodEntry = { id: string; mealType: string; foodName: string; grams: number; kcalPer100g: number; kcal: number };

type Props = {
  initialDate: string;
  initialLogs: MealLog[];
  recentWeights: WeightEntry[];
  initialFoodEntries: FoodEntry[];
};

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateStr: string) {
  const today = toDateKey(new Date());
  const yest = toDateKey(new Date(Date.now() - 86400000));
  if (dateStr === today) return "Today";
  if (dateStr === yest) return "Yesterday";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function DietClient({ initialDate, initialLogs, recentWeights: initialWeights, initialFoodEntries }: Props) {
  const [date, setDate] = useState(initialDate);
  const [logs, setLogs] = useState<MealLog[]>(initialLogs);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>(initialFoodEntries);
  const [weights, setWeights] = useState<WeightEntry[]>(initialWeights);
  const [loadingDate, setLoadingDate] = useState(false);

  // Food modal
  const [modalMealType, setModalMealType] = useState("");
  const [showFoodModal, setShowFoodModal] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [gramsInput, setGramsInput] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const [saving, setSaving] = useState(false);

  // Barcode scanner
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "found" | "error">("idle");
  const [scanError, setScanError] = useState("");
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(null);

  // Online search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onlineResults, setOnlineResults] = useState<BarcodeProduct[]>([]);
  const [onlineSearching, setOnlineSearching] = useState(false);

  // Weight
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);

  // ── date navigation ────────────────────────────────────────────────────
  async function changeDate(delta: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    const newDate = toDateKey(d);
    if (newDate > toDateKey(new Date())) return;
    setLoadingDate(true);
    const [logsRes, foodRes] = await Promise.all([
      fetch(`/api/diet/logs?date=${newDate}`),
      fetch(`/api/diet/food?date=${newDate}`),
    ]);
    if (logsRes.ok) setLogs(await logsRes.json());
    if (foodRes.ok) setFoodEntries(await foodRes.json());
    setDate(newDate);
    setLoadingDate(false);
  }

  // ── food modal ─────────────────────────────────────────────────────────
  const searchOnline = useCallback((q: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setOnlineResults([]);
    if (q.trim().length < 2) { setOnlineSearching(false); return; }
    setOnlineSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/diet/search?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) setOnlineResults(await res.json());
      } finally {
        setOnlineSearching(false);
      }
    }, 600);
  }, []);

  function openFoodModal(mealType: string) {
    setModalMealType(mealType);
    setSearch("");
    setSelected(null);
    setGramsInput("");
    setCustomMode(false);
    setCustomName("");
    setCustomKcal("");
    setScanState("idle");
    setScanError("");
    setScannedProduct(null);
    setOnlineResults([]);
    setOnlineSearching(false);
    setShowFoodModal(true);
  }

  async function handleBarcodeImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanState("scanning");
    setScanError("");
    setScannedProduct(null);

    try {
      let barcode = "";

      // Try native BarcodeDetector first (Android Chrome)
      if ("BarcodeDetector" in window) {
        const bd = new (window as unknown as { BarcodeDetector: new (opts: object) => { detect: (img: ImageBitmap) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
        const bitmap = await createImageBitmap(file);
        const results = await bd.detect(bitmap);
        if (results.length > 0) barcode = results[0].rawValue;
      }

      if (!barcode) {
        setScanState("error");
        setScanError("Barcode not detected. Try better lighting or enter it manually.");
        return;
      }

      const res = await fetch(`/api/diet/barcode?code=${encodeURIComponent(barcode)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setScanState("error");
        setScanError(err.error ?? "Product not found in Open Food Facts database.");
        return;
      }

      const product: BarcodeProduct = await res.json();
      setScannedProduct(product);
      setCustomName(product.name);
      setCustomKcal(String(product.kcalPer100g));
      setScanState("found");
    } catch {
      setScanState("error");
      setScanError("Scan failed. Check your connection or enter the barcode manually.");
    } finally {
      if (barcodeInputRef.current) barcodeInputRef.current.value = "";
    }
  }

  function applyScannedProduct() {
    if (!scannedProduct) return;
    setSelected({ name: scannedProduct.name, kcalPer100g: scannedProduct.kcalPer100g, category: scannedProduct.brand || "Scanned" });
    setScannedProduct(null);
    setScanState("idle");
    setGramsInput("");
  }

  function applyOnlineProduct(p: BarcodeProduct) {
    setSelected({ name: p.name, kcalPer100g: p.kcalPer100g, category: p.brand || "Online" });
    setOnlineResults([]);
    setSearch("");
    setGramsInput("");
  }

  function closeFoodModal() {
    setShowFoodModal(false);
  }

  const filteredFoods = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return FOODS.slice(0, 12);
    return FOODS.filter(f => f.name.toLowerCase().includes(q)).slice(0, 12);
  }, [search]);

  const liveKcal = useMemo(() => {
    const g = parseFloat(gramsInput);
    if (!g || g <= 0) return null;
    if (selected) return Math.round((g * selected.kcalPer100g) / 100);
    if (customMode) {
      const kp = parseFloat(customKcal);
      if (!kp || kp <= 0) return null;
      return Math.round((g * kp) / 100);
    }
    return null;
  }, [gramsInput, selected, customMode, customKcal]);

  async function addFood() {
    const g = parseFloat(gramsInput);
    if (!g || g <= 0) return;

    const foodName = customMode ? customName.trim() : selected?.name ?? "";
    const kcalPer100g = customMode ? parseFloat(customKcal) : selected?.kcalPer100g ?? 0;
    if (!foodName || !kcalPer100g) return;

    setSaving(true);
    const res = await fetch("/api/diet/food", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, mealType: modalMealType, foodName, grams: g, kcalPer100g }),
    });
    if (res.ok) {
      const entry: FoodEntry = await res.json();
      setFoodEntries(prev => [...prev, entry]);
      setGramsInput("");
      setSelected(null);
      setCustomMode(false);
      setCustomName("");
      setCustomKcal("");
      setSearch("");
    }
    setSaving(false);
  }

  async function deleteFood(id: string) {
    const res = await fetch(`/api/diet/food/${id}`, { method: "DELETE" });
    if (res.ok) setFoodEntries(prev => prev.filter(e => e.id !== id));
  }

  // ── weight ─────────────────────────────────────────────────────────────
  async function saveWeight() {
    const val = parseFloat(weightInput);
    if (!weightInput || isNaN(val) || val <= 0) return;
    setSavingWeight(true);
    const res = await fetch("/api/peso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: val, date }),
    });
    if (res.ok) {
      const entry = await res.json();
      setWeights(prev => [entry, ...prev].slice(0, 14));
      setWeightInput("");
    }
    setSavingWeight(false);
  }

  // ── computed ────────────────────────────────────────────────────────────
  const todayWeight = weights.find(w => w.date.slice(0, 10) === date);
  const isToday = date === toDateKey(new Date());
  const dailyKcal = foodEntries.reduce((s, e) => s + e.kcal, 0);

  function mealEntries(mealType: string) {
    return foodEntries.filter(e => e.mealType === mealType);
  }
  function mealKcal(mealType: string) {
    return mealEntries(mealType).reduce((s, e) => s + e.kcal, 0);
  }

  const modalMeal = MEALS.find(m => m.type === modalMealType);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28">
      <h1 className="text-xl font-bold text-[#ede9ff] mb-5">🥗 Diet tracker</h1>

      {/* Date navigation */}
      <div className="flex items-center justify-between rounded-2xl border px-4 py-3 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <button onClick={() => changeDate(-1)} disabled={loadingDate} className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold disabled:opacity-40" style={{ color: "var(--theme-text-muted)" }}>‹</button>
        <div className="text-center">
          <p className="font-semibold text-[#ede9ff] text-sm">{formatDateLabel(date)}</p>
          <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{new Date(date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday || loadingDate} className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold disabled:opacity-30" style={{ color: "var(--theme-text-muted)" }}>›</button>
      </div>

      {/* Daily kcal summary */}
      <div className="rounded-2xl border p-4 mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-[#ede9ff]">🔥 Daily calories</p>
          <div className="text-right">
            <span className="text-lg font-bold text-amber-400">{dailyKcal}</span>
            <span className="text-xs ml-1" style={{ color: "var(--theme-text-muted)" }}>/ {DAILY_TARGET} kcal</span>
          </div>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--theme-bg)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (dailyKcal / DAILY_TARGET) * 100)}%`,
              background: dailyKcal > DAILY_TARGET ? "#ef4444" : dailyKcal > DAILY_TARGET * 0.8 ? "#f59e0b" : "var(--theme-accent)",
            }}
          />
        </div>
        {dailyKcal === 0 && (
          <p className="text-xs mt-1.5" style={{ color: "var(--theme-text-muted)" }}>Add foods to each meal to track calories</p>
        )}
        {dailyKcal > 0 && (
          <div className="flex gap-3 mt-2">
            {MEALS.map(m => {
              const k = mealKcal(m.type);
              if (!k) return null;
              return (
                <div key={m.type} className="text-center">
                  <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>{m.icon}</p>
                  <p className="text-[10px] font-semibold text-amber-400">{k}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weight entry */}
      <div className="rounded-2xl border p-4 mb-5" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#ede9ff]">⚖️ Weight</p>
            {todayWeight ? (
              <p className="text-xl font-bold text-amber-400">{todayWeight.weight} kg</p>
            ) : (
              <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Not logged yet</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveWeight()}
              placeholder="e.g. 72.5"
              step="0.1"
              min="0"
              className="w-24 px-3 py-2 rounded-xl text-sm text-[#ede9ff] placeholder-[#4a3a7a] focus:outline-none focus:ring-2 focus:ring-amber-500/40 border"
              style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
            />
            <button
              onClick={saveWeight}
              disabled={savingWeight || !weightInput}
              className="px-3 py-2 bg-amber-500 text-black rounded-xl text-sm font-bold disabled:opacity-50 active:scale-95 transition-all"
            >
              {savingWeight ? "..." : "Log"}
            </button>
          </div>
        </div>
        {weights.length >= 2 && (
          <div className="mt-3 flex items-end gap-1.5 h-10">
            {[...weights].reverse().slice(-10).map((w, i, arr) => {
              const vals = arr.map(x => x.weight);
              const min = Math.min(...vals);
              const max = Math.max(...vals);
              const range = max - min || 1;
              const h = 8 + ((w.weight - min) / range) * 28;
              const isLast = i === arr.length - 1;
              return (
                <div key={w.id} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className={`w-full rounded-t-sm transition-all ${isLast ? "bg-amber-400" : "bg-violet-600/60"}`} style={{ height: `${h}px` }} />
                  {isLast && <span className="text-[8px] text-amber-400 font-bold">{w.weight}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Meal sections */}
      <div className="space-y-3" style={{ opacity: loadingDate ? 0.6 : 1 }}>
        {MEALS.map(meal => {
          const entries = mealEntries(meal.type);
          const mealTotal = mealKcal(meal.type);
          const log = logs.find(l => l.mealType === meal.type);

          return (
            <div key={meal.type} className="rounded-2xl border p-4" style={{ background: "var(--theme-surface)", borderColor: entries.length > 0 ? "var(--theme-accent)" : "var(--theme-surface-border)" }}>
              {/* Meal header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meal.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#ede9ff] leading-tight">{meal.label}</p>
                    <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>{meal.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mealTotal > 0 && (
                    <span className="text-xs font-bold text-amber-400">{mealTotal} kcal</span>
                  )}
                  <button
                    onClick={() => openFoodModal(meal.type)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold transition-colors"
                    style={{ background: "var(--theme-bg)", color: "var(--theme-accent)" }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Food entries */}
              {entries.length > 0 && (
                <div className="space-y-1.5 mb-1">
                  {entries.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--theme-bg)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#ede9ff] truncate">{entry.foodName}</p>
                        <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>{entry.grams}g · {entry.kcalPer100g} kcal/100g</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-bold text-amber-400">{entry.kcal} kcal</span>
                        <button
                          onClick={() => deleteFood(entry.id)}
                          className="text-sm leading-none hover:text-red-400 transition-colors"
                          style={{ color: "var(--theme-surface-border)" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy text log (backward compat) */}
              {entries.length === 0 && log && (
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{log.text}</p>
              )}

              {entries.length === 0 && !log && (
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Tap + to add food</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Food add modal */}
      {showFoodModal && modalMeal && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-[60]" onClick={closeFoodModal}>
          <div
            className="rounded-t-2xl border w-full max-w-lg flex flex-col"
            style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)", maxHeight: "85vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <div>
                <h3 className="font-bold text-[#ede9ff]">{modalMeal.icon} {modalMeal.label}</h3>
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>Add a food item</p>
              </div>
              <button onClick={closeFoodModal} className="w-8 h-8 flex items-center justify-center rounded-xl text-lg" style={{ color: "var(--theme-text-muted)" }}>×</button>
            </div>

            {/* Grams + add (when food selected or custom) */}
            {(selected || customMode) && (
              <div className="px-5 pb-4 flex-shrink-0 border-t" style={{ borderColor: "var(--theme-surface-border)" }}>
                <div className="pt-3">
                  {selected && (
                    <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl" style={{ background: "var(--theme-bg)" }}>
                      <div>
                        <p className="text-sm font-semibold text-[#ede9ff]">{selected.name}</p>
                        <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{selected.kcalPer100g} kcal/100g · {selected.category}</p>
                      </div>
                      <button onClick={() => setSelected(null)} className="text-xs px-2 py-1 rounded-lg" style={{ color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}>change</button>
                    </div>
                  )}
                  {customMode && (
                    <div className="space-y-2 mb-3">
                      <input
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        placeholder="Food name"
                        autoFocus
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-[#ede9ff] placeholder-[#4a3a7a] focus:outline-none focus:ring-2 focus:ring-amber-500/40 border"
                        style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                      />
                      <input
                        type="number"
                        value={customKcal}
                        onChange={e => setCustomKcal(e.target.value)}
                        placeholder="kcal per 100g"
                        min="0"
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-[#ede9ff] placeholder-[#4a3a7a] focus:outline-none focus:ring-2 focus:ring-amber-500/40 border"
                        style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={gramsInput}
                        onChange={e => setGramsInput(e.target.value)}
                        placeholder="Grams"
                        min="0"
                        step="1"
                        autoFocus={!customMode}
                        className="w-full px-3 py-2.5 rounded-xl text-sm text-[#ede9ff] placeholder-[#4a3a7a] focus:outline-none focus:ring-2 focus:ring-amber-500/40 border"
                        style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                      />
                    </div>
                    {liveKcal !== null && (
                      <div className="text-center flex-shrink-0">
                        <p className="text-lg font-bold text-amber-400">{liveKcal}</p>
                        <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>kcal</p>
                      </div>
                    )}
                    <button
                      onClick={addFood}
                      disabled={saving || !gramsInput || (!selected && !customMode) || (customMode && (!customName.trim() || !customKcal))}
                      className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold disabled:opacity-50 active:scale-95 transition-all flex-shrink-0"
                    >
                      {saving ? "..." : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Search (when no food selected) */}
            {!selected && !customMode && (
              <>
                {/* Barcode scanner button */}
                <div className="px-5 pb-3 flex-shrink-0">
                  <input
                    ref={barcodeInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleBarcodeImage}
                  />
                  <button
                    onClick={() => barcodeInputRef.current?.click()}
                    disabled={scanState === "scanning"}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors active:scale-[0.98] disabled:opacity-50"
                    style={{ borderColor: "var(--theme-accent)", color: "var(--theme-accent)", background: "var(--theme-bg)" }}
                  >
                    {scanState === "scanning" ? (
                      <><span className="animate-spin">⟳</span> Scanning…</>
                    ) : (
                      <><span>📷</span> Scan barcode</>
                    )}
                  </button>

                  {/* Scan error */}
                  {scanState === "error" && (
                    <div className="mt-2 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--theme-bg)", color: "#f87171" }}>
                      {scanError}
                    </div>
                  )}

                  {/* Scanned product card */}
                  {scanState === "found" && scannedProduct && (
                    <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: "var(--theme-accent)" }}>
                      <div className="px-3 py-3" style={{ background: "var(--theme-bg)" }}>
                        <div className="flex items-start gap-3">
                          {scannedProduct.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={scannedProduct.imageUrl} alt="" className="w-12 h-12 object-contain rounded-lg flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#ede9ff] leading-tight">{scannedProduct.name}</p>
                            {scannedProduct.brand && <p className="text-xs mt-0.5" style={{ color: "var(--theme-text-muted)" }}>{scannedProduct.brand}</p>}
                          </div>
                        </div>
                        {/* Macros grid */}
                        <div className="grid grid-cols-4 gap-1.5 mt-3">
                          {[
                            { label: "Kcal", value: scannedProduct.kcalPer100g, color: "text-amber-400" },
                            { label: "Proteine", value: `${scannedProduct.proteins}g`, color: "text-[#ede9ff]" },
                            { label: "Carboidrati", value: `${scannedProduct.carbs}g`, color: "text-[#ede9ff]" },
                            { label: "Grassi", value: `${scannedProduct.fat}g`, color: "text-[#ede9ff]" },
                          ].map(m => (
                            <div key={m.label} className="text-center px-1 py-1.5 rounded-lg" style={{ background: "var(--theme-surface)" }}>
                              <p className={`text-xs font-bold ${m.color}`}>{m.value}</p>
                              <p className="text-[9px] mt-0.5" style={{ color: "var(--theme-text-muted)" }}>{m.label}</p>
                            </div>
                          ))}
                        </div>
                        {scannedProduct.ingredients && (
                          <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "var(--theme-text-muted)" }}>
                            <span className="font-semibold">Ingredienti: </span>{scannedProduct.ingredients}
                            {scannedProduct.ingredients.length >= 300 ? "…" : ""}
                          </p>
                        )}
                        <button
                          onClick={applyScannedProduct}
                          className="w-full mt-3 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold active:scale-95 transition-all"
                        >
                          Use this product →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-5 pb-3 flex-shrink-0">
                  <div className="relative">
                    <input
                      value={search}
                      onChange={e => { setSearch(e.target.value); searchOnline(e.target.value); }}
                      placeholder="Type food name (e.g. pasta, pollo, pane...)"
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-[#ede9ff] placeholder-[#4a3a7a] focus:outline-none focus:ring-2 focus:ring-amber-500/40 border"
                      style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
                    />
                    {onlineSearching && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-spin" style={{ color: "var(--theme-text-muted)" }}>⟳</span>
                    )}
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 px-5 pb-5">
                  <div className="space-y-1.5">
                    {/* Local food list */}
                    {filteredFoods.map(food => (
                      <button
                        key={food.name}
                        onClick={() => { setSelected(food); setGramsInput(""); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors active:scale-[0.98]"
                        style={{ background: "var(--theme-bg)" }}
                      >
                        <div>
                          <p className="text-sm text-[#ede9ff]">{food.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>{food.category}</p>
                        </div>
                        <span className="text-xs font-semibold text-amber-400 flex-shrink-0 ml-2">{food.kcalPer100g} kcal/100g</span>
                      </button>
                    ))}

                    {/* Online results from Open Food Facts */}
                    {onlineResults.length > 0 && (
                      <>
                        <p className="text-[10px] px-1 pt-1" style={{ color: "var(--theme-text-muted)" }}>🌐 Online results</p>
                        {onlineResults.map((p, i) => (
                          <button
                            key={i}
                            onClick={() => applyOnlineProduct(p)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors active:scale-[0.98]"
                            style={{ background: "var(--theme-bg)" }}
                          >
                            {p.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imageUrl} alt="" className="w-9 h-9 object-contain rounded-lg flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[#ede9ff] truncate">{p.name}</p>
                              {p.brand && <p className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>{p.brand}</p>}
                            </div>
                            <span className="text-xs font-semibold text-amber-400 flex-shrink-0">{p.kcalPer100g} kcal/100g</span>
                          </button>
                        ))}
                      </>
                    )}

                    <button
                      onClick={() => { setCustomMode(true); setSearch(""); }}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-sm border-dashed border transition-colors"
                      style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
                    >
                      ✏️ Add manually with custom kcal/100g
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
