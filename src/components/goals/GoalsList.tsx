"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, getPriorityColor, getPriorityLabel, dayKey } from "@/lib/utils";

type Category = { id: string; name: string; color: string };
type Tag = { id: string; name: string };
type Milestone = { id: string; title: string; completed: boolean };
type GoalTag = { tag: Tag };

type Goal = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  points: number;
  targetDate: string | null;
  reminderTime: string | null;
  dailyCheckIn?: boolean;
  checkInDays?: string | null;
  checkInXP?: number;
  category: Category | null;
  milestones: Milestone[];
  tags: GoalTag[];
};

type Props = {
  goals: Goal[];
  categories: Category[];
};

type Suggestion = {
  icon: string;
  title: string;
  desc: string;
  durationDays?: number;
  milestoneType?: "daily" | "weekly" | "sessions";
  sessionsPerWeek?: number;
};

function suggestionHref(s: Suggestion): string {
  const p = new URLSearchParams({ title: s.title });
  if (s.durationDays) p.set("days", String(s.durationDays));
  if (s.milestoneType) p.set("mtype", s.milestoneType);
  if (s.sessionsPerWeek) p.set("spw", String(s.sessionsPerWeek));
  return `/goals/new?${p.toString()}`;
}

const SUGGESTIONS: Record<string, Suggestion[]> = {
  _all: [
    { icon: "🏋️", title: "Vai in palestra 3 volte a settimana per un mese", desc: "Fitness · Salute", durationDays: 30, milestoneType: "sessions", sessionsPerWeek: 3 },
    { icon: "📚", title: "Leggi almeno 1 ora ogni giorno per 30 giorni", desc: "Lettura · Personale", durationDays: 30, milestoneType: "daily" },
    { icon: "💧", title: "Bevi 2L d'acqua ogni giorno per 21 giorni", desc: "Idratazione · Salute", durationDays: 21, milestoneType: "daily" },
    { icon: "😴", title: "Dormi 8 ore ogni notte per 30 giorni", desc: "Recupero · Salute", durationDays: 30, milestoneType: "daily" },
    { icon: "🧘", title: "Stretching 10 minuti dopo ogni allenamento per un mese", desc: "Recupero · Salute", durationDays: 30, milestoneType: "sessions", sessionsPerWeek: 3 },
    { icon: "🍳", title: "Prepara i pasti della settimana ogni domenica per un mese", desc: "Alimentazione · Casa", durationDays: 30, milestoneType: "weekly" },
    { icon: "📓", title: "Scrivi nel diario ogni sera per 30 giorni", desc: "Riflessione · Personale", durationDays: 30, milestoneType: "daily" },
    { icon: "📵", title: "Niente telefono per i primi 30 minuti dopo svegliarti per 21 giorni", desc: "Routine mattutina", durationDays: 21, milestoneType: "daily" },
  ],
  Health: [
    { icon: "🏋️", title: "Vai in palestra 3 volte a settimana per un mese", desc: "Obiettivo costanza", durationDays: 30, milestoneType: "sessions", sessionsPerWeek: 3 },
    { icon: "💧", title: "Bevi 2L d'acqua ogni giorno per 21 giorni", desc: "Abitudine idratazione", durationDays: 21, milestoneType: "daily" },
    { icon: "😴", title: "Dormi 8 ore ogni notte per 30 giorni", desc: "Routine sonno", durationDays: 30, milestoneType: "daily" },
    { icon: "🧘", title: "Stretching 10 minuti dopo ogni allenamento per un mese", desc: "Abitudine recupero", durationDays: 30, milestoneType: "sessions", sessionsPerWeek: 3 },
    { icon: "🥦", title: "Cucina una nuova ricetta sana ogni settimana per un mese", desc: "Varietà alimentare", durationDays: 30, milestoneType: "weekly" },
    { icon: "🚶", title: "Cammina almeno 8.000 passi nei giorni di riposo per 2 settimane", desc: "Recupero attivo", durationDays: 14, milestoneType: "daily" },
    { icon: "🥗", title: "Mangia un pasto equilibrato (proteine, carboidrati, verdure) ogni giorno per 2 settimane", desc: "Abitudine alimentare", durationDays: 14, milestoneType: "daily" },
    { icon: "🚫", title: "Zero alcol per 30 giorni", desc: "Sfida detox", durationDays: 30, milestoneType: "weekly" },
    { icon: "☀️", title: "Routine di stretching mattutino ogni giorno per 21 giorni", desc: "Abitudine flessibilità", durationDays: 21, milestoneType: "daily" },
    { icon: "💪", title: "Fai 30 flessioni ogni giorno per 30 giorni", desc: "Abitudine forza", durationDays: 30, milestoneType: "daily" },
  ],
  Finance: [
    { icon: "💰", title: "Risparmia €200 questo mese", desc: "Obiettivo risparmio mensile", durationDays: 30, milestoneType: "weekly" },
    { icon: "🧾", title: "Registra ogni spesa per 30 giorni", desc: "Consapevolezza finanziaria", durationDays: 30, milestoneType: "weekly" },
    { icon: "🍳", title: "Cucina a casa ogni giorno per un mese", desc: "Ridurre spese ristorante", durationDays: 30, milestoneType: "daily" },
    { icon: "📊", title: "Cancella tutti gli abbonamenti inutilizzati questa settimana", desc: "Ridurre costi fissi", durationDays: 7, milestoneType: "daily" },
    { icon: "🎯", title: "Crea un fondo di emergenza da €500 in 3 mesi", desc: "Sicurezza finanziaria", durationDays: 90, milestoneType: "weekly" },
    { icon: "🛒", title: "Pianifica la lista della spesa prima di andare a fare acquisti per un mese", desc: "Ridurre sprechi alimentari", durationDays: 30, milestoneType: "weekly" },
  ],
  Personal: [
    { icon: "📚", title: "Leggi almeno 1 ora ogni giorno per 30 giorni", desc: "Abitudine lettura", durationDays: 30, milestoneType: "daily" },
    { icon: "📵", title: "Niente telefono per i primi 30 minuti dopo svegliarti per 21 giorni", desc: "Routine mattutina", durationDays: 21, milestoneType: "daily" },
    { icon: "🌅", title: "Segui una routine mattutina ogni giorno per 21 giorni", desc: "Inizia bene la giornata", durationDays: 21, milestoneType: "daily" },
    { icon: "📓", title: "Scrivi nel diario ogni sera per 30 giorni", desc: "Riflessione quotidiana", durationDays: 30, milestoneType: "daily" },
    { icon: "📵", title: "Niente social media per 7 giorni", desc: "Detox digitale", durationDays: 7, milestoneType: "daily" },
    { icon: "🧺", title: "Lava e riponi i vestiti lo stesso giorno ogni settimana per un mese", desc: "Routine domestica", durationDays: 30, milestoneType: "weekly" },
    { icon: "🧹", title: "Pulisci a fondo un'area della casa ogni settimana per un mese", desc: "Manutenzione casa", durationDays: 30, milestoneType: "weekly" },
    { icon: "🛒", title: "Fai la spesa con una lista preparata per un mese", desc: "Pianifica prima di fare la spesa", durationDays: 30, milestoneType: "weekly" },
    { icon: "🍳", title: "Prepara i pasti domenica per la settimana per un mese", desc: "Risparmia tempo durante la settimana", durationDays: 30, milestoneType: "weekly" },
    { icon: "🎌", title: "Finisci di guardare una serie anime completa questo mese", desc: "Obiettivo intrattenimento", durationDays: 30, milestoneType: "weekly" },
    { icon: "🎬", title: "Serata film ogni venerdì per un mese", desc: "Piacere settimanale", durationDays: 30, milestoneType: "weekly" },
    { icon: "🎮", title: "Finisci un gioco che hai iniziato ma mai completato", desc: "Obiettivo intrattenimento" },
  ],
  Learning: [
    { icon: "📚", title: "Leggi almeno 1 ora ogni giorno per 30 giorni", desc: "Abitudine lettura", durationDays: 30, milestoneType: "daily" },
    { icon: "💻", title: "Completa un corso online questo mese", desc: "Nuova competenza", durationDays: 30, milestoneType: "weekly" },
    { icon: "🗣️", title: "Impara 5 nuove parole in una lingua ogni giorno per 30 giorni", desc: "Apprendimento lingue", durationDays: 30, milestoneType: "daily" },
    { icon: "🎸", title: "Esercitati su uno strumento 20 min ogni giorno per 30 giorni", desc: "Competenza musicale", durationDays: 30, milestoneType: "daily" },
    { icon: "✍️", title: "Scrivi 500 parole ogni giorno per 30 giorni", desc: "Pratica scrittura", durationDays: 30, milestoneType: "daily" },
    { icon: "📺", title: "Guarda 1 video educativo ogni giorno per 2 settimane", desc: "Apprendimento quotidiano", durationDays: 14, milestoneType: "daily" },
  ],
  Work: [
    { icon: "⏰", title: "Inizia a lavorare alla stessa ora ogni giorno per 21 giorni", desc: "Routine smartworking", durationDays: 21, milestoneType: "daily" },
    { icon: "🖥️", title: "Termina il lavoro a un orario fisso ogni giorno per 3 settimane", desc: "Equilibrio vita-lavoro", durationDays: 21, milestoneType: "daily" },
    { icon: "📋", title: "Pianifica i compiti di domani prima di andare a letto per 21 giorni", desc: "Pianificazione serale", durationDays: 21, milestoneType: "daily" },
    { icon: "☕", title: "Fai una pausa pranzo lontano dallo schermo ogni giorno per 2 settimane", desc: "Abitudine riposo", durationDays: 14, milestoneType: "daily" },
    { icon: "🚫", title: "Niente telefono durante i blocchi di lavoro intenso per 2 settimane", desc: "Deep focus", durationDays: 14, milestoneType: "daily" },
    { icon: "⏱️", title: "2 ore di lavoro intenso ogni mattina per 30 giorni", desc: "Abitudine focus", durationDays: 30, milestoneType: "daily" },
    { icon: "🤝", title: "Crea connessioni con 2 nuove persone questo mese", desc: "Crescita professionale", durationDays: 30, milestoneType: "weekly" },
    { icon: "🎯", title: "Completa un progetto chiave questo mese", desc: "Concentrati su ciò che conta", durationDays: 30, milestoneType: "weekly" },
  ],
};

export default function GoalsList({ goals, categories }: Props) {
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "archived">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "deadline" | "progress" | "xp">("newest");
  const [showSuggestions, setShowSuggestions] = useState(goals.length === 0);

  const filtered = goals
    .filter((g) => {
      if (filter === "all" && g.status === "archived") return false;
      if (filter === "active" && g.status !== "active") return false;
      if (filter === "completed" && g.status !== "completed") return false;
      if (filter === "archived" && g.status !== "archived") return false;
      if (categoryId !== "all" && g.category?.id !== categoryId) return false;
      if (priorityFilter !== "all" && g.priority !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "deadline") {
        if (!a.targetDate && !b.targetDate) return 0;
        if (!a.targetDate) return 1;
        if (!b.targetDate) return -1;
        return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
      }
      if (sort === "progress") return b.progress - a.progress;
      return 0; // "newest" — already ordered by server
    });

  const activeCategoryName = categoryId === "all"
    ? null
    : categories.find((c) => c.id === categoryId)?.name ?? null;

  const suggestions: Suggestion[] =
    activeCategoryName && SUGGESTIONS[activeCategoryName]
      ? SUGGESTIONS[activeCategoryName]
      : SUGGESTIONS._all;

  return (
    <>
      {/* Status filters */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {(["all", "active", "completed", "archived"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors border"
            style={
              filter === f
                ? { background: "var(--theme-accent)", color: "#000", borderColor: "var(--theme-accent)", fontWeight: 700 }
                : { background: "var(--theme-surface)", color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }
            }
          >
            {f === "all" ? "Tutte" : f === "active" ? "⚡ Attive" : f === "completed" ? "👑 Completate" : "📦 Archiviate"}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <span className="flex-shrink-0 text-xs self-center" style={{ color: "var(--theme-text-muted)" }}>Ordina:</span>
        {(["newest", "deadline", "progress"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border"
            style={
              sort === s
                ? { background: "var(--theme-surface-border)", color: "#ede9ff", borderColor: "var(--theme-surface-border)" }
                : { background: "var(--theme-surface)", color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }
            }
          >
            {s === "newest" ? "🕐 Più recenti" : s === "deadline" ? "🌙 Scadenza" : "📊 Progresso"}
          </button>
        ))}
      </div>

      {/* Priority filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <span className="flex-shrink-0 text-xs self-center" style={{ color: "var(--theme-text-muted)" }}>Priorità:</span>
        {(["all", "high", "medium", "low"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border"
            style={
              priorityFilter === p
                ? { background: "var(--theme-surface-border)", color: "#ede9ff", borderColor: "var(--theme-surface-border)" }
                : { background: "var(--theme-surface)", color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }
            }
          >
            {p === "all" ? "Tutte" : p === "high" ? "🔥 Alta" : p === "medium" ? "⚡ Media" : "🍃 Bassa"}
          </button>
        ))}
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryId("all")}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border"
            style={
              categoryId === "all"
                ? { background: "#ede9ff", color: "#0c0a1a", borderColor: "#ede9ff" }
                : { background: "var(--theme-surface)", color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }
            }
          >
            Tutte
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border"
              style={
                categoryId === c.id
                  ? { backgroundColor: c.color, borderColor: c.color, color: "#000" }
                  : { background: "var(--theme-surface)", color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center mb-4" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <div className="text-4xl mb-3">📜</div>
          <p className="text-sm mb-4" style={{ color: "var(--theme-text-muted)" }}>Nessuna missione</p>
          <Link
            href="/goals/new"
            className="inline-block px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl text-sm font-bold"
          >
            Crea missione
          </Link>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {filtered.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}

      {/* Quest suggestions */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
        <button
          onClick={() => setShowSuggestions((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold" style={{ color: "var(--theme-text-muted)" }}>
            💡 Idee missioni{activeCategoryName ? ` · ${activeCategoryName}` : ""}
          </span>
          <span className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{showSuggestions ? "▲" : "▼"}</span>
        </button>

        {showSuggestions && (
          <div className="px-5 pb-5 space-y-2">
            {suggestions.map((s) => (
              <Link
                key={s.title}
                href={suggestionHref(s)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors group hover:border-amber-500/30"
                style={{ background: "var(--theme-bg)", borderColor: "var(--theme-surface-border)" }}
              >
                <span className="text-xl flex-shrink-0">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#ede9ff] leading-snug">{s.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--theme-text-muted)" }}>
                    {s.desc}
                    {s.durationDays && (
                      <span className="ml-2 text-amber-500/70">
                        · {s.milestoneType === "daily"
                          ? `${s.durationDays} checkpoint giornalieri`
                          : s.milestoneType === "sessions" && s.sessionsPerWeek
                          ? `${Math.ceil(s.durationDays / 7) * s.sessionsPerWeek} sessioni`
                          : `${Math.ceil(s.durationDays / 7)} checkpoint settimanali`}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-lg flex-shrink-0 group-hover:text-amber-400 transition-colors" style={{ color: "var(--theme-surface-border)" }}>+</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const milestonesDone = goal.milestones.filter((m) => m.completed).length;
  const milestonesTotal = goal.milestones.length;
  const isOverdue = goal.status === "active" && !!goal.targetDate && goal.targetDate < dayKey();

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="block rounded-2xl border p-4 hover:border-amber-500/40 transition-colors"
      style={{ background: "var(--theme-surface)", borderColor: isOverdue ? "rgba(239,68,68,0.35)" : "var(--theme-surface-border)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-[#ede9ff] line-clamp-2 flex-1">{goal.title}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium border ${
            goal.status === "completed"
              ? "bg-amber-900/30 text-amber-300 border-amber-700/40"
              : goal.status === "archived"
              ? "bg-zinc-800/60 text-zinc-400 border-zinc-600/40"
              : "bg-violet-900/30 text-violet-300 border-violet-700/40"
          }`}
        >
          {goal.status === "completed" ? "👑 Completata" : goal.status === "archived" ? "📦 Archiviata" : "⚡ Attiva"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {goal.category && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: goal.category.color + "25", color: goal.category.color }}
          >
            {goal.category.name}
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityColor(goal.priority)}`}>
          {getPriorityLabel(goal.priority)}
        </span>
        {goal.tags.slice(0, 2).map(({ tag }) => (
          <span
            key={tag.id}
            className="text-xs px-2 py-0.5 rounded-full border"
            style={{ background: "var(--theme-bg)", color: "var(--theme-text-muted)", borderColor: "var(--theme-surface-border)" }}
          >
            #{tag.name}
          </span>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--theme-text-muted)" }}>
          <span>
            {milestonesTotal > 0 ? `${milestonesDone}/${milestonesTotal} milestone` : "Progresso"}
          </span>
          <span className="text-amber-400/80">{goal.progress}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--theme-bg)" }}>
          <div
            className={`h-full rounded-full transition-all ${
              goal.progress >= 100 ? "bg-amber-400" : goal.progress >= 50 ? "bg-violet-500" : "bg-violet-700"
            }`}
            style={{ width: `${goal.progress}%` }}
          />
        </div>
      </div>

      {(goal.targetDate || goal.reminderTime || goal.dailyCheckIn) && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {goal.targetDate && (
            <p className={`text-xs ${isOverdue ? "text-red-400 font-semibold" : ""}`} style={isOverdue ? {} : { color: "var(--theme-text-muted)" }}>
              {isOverdue ? "⚠️" : "🌙"} {formatDate(goal.targetDate)}
            </p>
          )}
          {goal.reminderTime && (
            <span className="text-xs px-1.5 py-0.5 rounded-full border border-amber-700/30 bg-amber-900/20 text-amber-400/80">
              🔔 {goal.reminderTime}
            </span>
          )}
          {goal.dailyCheckIn && (
            <span className="text-xs px-1.5 py-0.5 rounded-full border border-violet-700/30 bg-violet-900/20 text-violet-300/80">
              📅 {goal.checkInDays
                ? `${goal.checkInDays.split(",").length}×/sett.`
                : "Ogni giorno"}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
