"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme, THEMES, type ThemeKey } from "@/components/ThemeProvider";
import { updateProfileName, updateTheme, updateReminder, updateHeroClass } from "@/app/(app)/profile/actions";
import NotificationButton from "@/components/NotificationButton";
import { getLevel, getLevelProgress, LEVEL_THRESHOLDS } from "@/lib/levels";
import { CLASSES, CLASS_GROUPS, getClassDef } from "@/lib/classes";

type Reward = { id: string; name: string; description: string; icon: string; type: string };
type UserReward = { id: string; reward: Reward; earnedAt: string };

type User = {
  id: string;
  name: string | null;
  email: string;
  points: number;
  userRewards: UserReward[];
};

type Stats = { total: number; completed: number; active: number };
type CategoryStat = { name: string; color: string; total: number; completed: number };

export default function ProfileClient({ user, stats, streak = 0, dbReminderEnabled = false, dbReminderTime = "09:00", categoryStats = [], weeklyMilestones = [0, 0, 0, 0], heroClass: initialHeroClass = null }: { user: User | null; stats: Stats; streak?: number; dbReminderEnabled?: boolean; dbReminderTime?: string; categoryStats?: CategoryStat[]; weeklyMilestones?: number[]; heroClass?: string | null }) {
  const router = useRouter();
  const { theme, colors, setTheme } = useTheme();
  const [heroClass, setHeroClass] = useState<string | null>(initialHeroClass);
  const [classExpanded, setClassExpanded] = useState(false);
  const [savingClass, setSavingClass] = useState(false);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmResetRewards, setConfirmResetRewards] = useState(false);
  const [resettingRewards, setResettingRewards] = useState(false);
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);
  const [wipingAll, setWipingAll] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name ?? "");
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [nameStatus, setNameStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [notifEnabled, setNotifEnabled] = useState(dbReminderEnabled);
  const [notifTime, setNotifTime] = useState(dbReminderTime);
  const [notifRequesting, setNotifRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setNotifPermission(Notification.permission);
    // Sync localStorage with DB values on mount
    localStorage.setItem("reminder-enabled", String(dbReminderEnabled));
    localStorage.setItem("reminder-time", dbReminderTime);

    // Re-read permission when the PWA returns to the foreground: the user may
    // have changed it in the OS/site settings while the app was backgrounded,
    // and the cached Notification.permission would otherwise show stale state.
    const refresh = () => {
      if (document.visibilityState === "visible") setNotifPermission(Notification.permission);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [dbReminderEnabled, dbReminderTime]);

  useEffect(() => {
    if (!notifEnabled || notifPermission !== "granted") return;
    const now = new Date();
    const [h, m] = notifTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const ms = target.getTime() - now.getTime();
    const id = setTimeout(() => {
      new Notification("⚔️ Ora delle missioni!", {
        body: "Non interrompere la serie! Completa una milestone oggi.",
      });
    }, ms);
    return () => clearTimeout(id);
  }, [notifEnabled, notifTime, notifPermission]);

  async function requestNotifPermission() {
    if (!("Notification" in window)) return;
    setNotifRequesting(true);
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    setNotifRequesting(false);
  }

  function toggleReminder(enabled: boolean) {
    setNotifEnabled(enabled);
    localStorage.setItem("reminder-enabled", String(enabled));
    updateReminder(enabled, notifTime);
  }

  function saveReminderTime(time: string) {
    setNotifTime(time);
    localStorage.setItem("reminder-time", time);
    updateReminder(notifEnabled, time);
  }

  async function saveName() {
    if (!nameInput.trim()) return;
    setNameStatus("saving");
    try {
      const result = await updateProfileName(nameInput.trim());
      if (result.ok) {
        setDisplayName(result.name ?? nameInput.trim());
        setNameStatus("saved");
        setTimeout(() => {
          setEditingName(false);
          setNameStatus("idle");
        }, 1200);
      } else {
        setNameStatus("error");
        setTimeout(() => setNameStatus("idle"), 3000);
      }
    } catch {
      setNameStatus("error");
      setTimeout(() => setNameStatus("idle"), 3000);
    }
  }

  async function saveClass(key: string) {
    setSavingClass(true);
    const cls = CLASSES.find((c) => c.key === key)!;
    // Optimistic: update UI immediately
    setHeroClass(key);
    setTheme(cls.theme);
    localStorage.setItem("hero-theme", cls.theme);
    setClassExpanded(false);
    try {
      await updateHeroClass(key);
      await updateTheme(cls.theme);
      router.refresh(); // re-runs layout so BottomNav picks up the new heroClass
    } catch {
      setHeroClass(initialHeroClass); // revert on failure
    }
    setSavingClass(false);
  }

  if (!user) return null;

  const { current: level, next: nextLevel, progress: progressToNext, xpNeeded } = getLevelProgress(user.points, heroClass);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#ede9ff] mb-6">{level.icon} Profilo Eroe</h1>

      {/* Hero card */}
      <div className="rounded-2xl p-5 text-white mb-6 relative overflow-hidden" style={{background: "var(--theme-gradient)", border: "1px solid var(--theme-border)"}}>
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10" style={{background: "radial-gradient(circle, var(--theme-accent) 0%, transparent 70%)"}}/>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold" style={{background: "linear-gradient(135deg, #3b2d6e, #1e1535)", border: "2px solid #f59e0b55"}}>
            {displayName?.[0]?.toUpperCase() || "⚔"}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2 mb-1">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="flex-1 bg-[#0f0826] border border-amber-500/40 rounded-lg px-2 py-1 text-[#ede9ff] text-sm font-bold focus:outline-none focus:ring-1 focus:ring-amber-500/60 min-w-0"
                />
                <button
                  onClick={saveName}
                  disabled={nameStatus === "saving" || nameStatus === "saved"}
                  className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all flex-shrink-0 disabled:opacity-60 ${
                    nameStatus === "saved"
                      ? "bg-green-900/40 border-green-600/60 text-green-400"
                      : nameStatus === "error"
                      ? "bg-red-900/40 border-red-600/60 text-red-400"
                      : "bg-amber-900/30 border-amber-700/40 text-amber-400"
                  }`}
                >
                  {nameStatus === "saving" ? "..." : nameStatus === "saved" ? "✓ Salvato!" : nameStatus === "error" ? "✗ Errore" : "Salva"}
                </button>
                <button
                  onClick={() => { setEditingName(false); setNameInput(displayName); }}
                  className="text-[#6b5a9e] text-xs px-1 flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1.5 group mb-1"
              >
                <h2 className="text-xl font-bold text-[#ede9ff] truncate">{displayName}</h2>
                <span className="text-[#4a3a7a] group-hover:text-amber-400 text-xs transition-colors flex-shrink-0">✏️</span>
              </button>
            )}
            <p className="text-[#9d8ac7] text-sm">{user.email}</p>
            <p className="text-sm font-semibold mt-0.5" style={{color: "var(--theme-accent)"}}>
              {level.icon} Lv. {level.level} — {level.label}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-sm opacity-80" style={{color: "var(--theme-accent)"}}>✨ {user.points} XP</span>
            {nextLevel && (
              <span className="text-[#9d8ac7] text-xs">{xpNeeded} XP al {nextLevel.label}</span>
            )}
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{background: "#0f0826"}}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progressToNext}%`, background: "var(--theme-bar)" }}
            />
          </div>
          {nextLevel ? (
            <p className="text-xs text-[#6b5a9e] mt-1">{progressToNext}% verso {nextLevel.icon} {nextLevel.label}</p>
          ) : (
            <p className="text-xs text-amber-400 mt-1">👑 Livello massimo — Leggendario!</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {[
          { label: "Totale", value: stats.total, icon: "📜" },
          { label: "Attive", value: stats.active, icon: "⚡" },
          { label: "Fatte", value: stats.completed, icon: "👑" },
          { label: "Serie", value: streak, icon: streak > 0 ? "🔥" : "💤" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border p-3 text-center" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-xl font-bold" style={{color: "var(--theme-accent)"}}>{s.value}</div>
            <div className="text-xs" style={{color: "var(--theme-text-muted)"}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly activity */}
      {weeklyMilestones.some((v) => v > 0) && (
        <div className="rounded-2xl border p-4 mb-6" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--theme-text-muted)" }}>📅 Milestone settimanali</h2>
          <div className="flex items-end gap-2 h-16">
            {weeklyMilestones.map((count, i) => {
              const max = Math.max(...weeklyMilestones, 1);
              const pct = Math.round((count / max) * 100);
              const labels = ["3 sett. fa", "2 sett. fa", "Scorsa", "Questa"];
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold" style={{ color: "var(--theme-accent)" }}>{count > 0 ? count : ""}</span>
                  <div className="w-full rounded-t-lg transition-all" style={{ height: `${Math.max(pct, 4)}%`, background: i === 3 ? "var(--theme-accent)" : "var(--theme-surface-border)" }} />
                  <span className="text-[10px]" style={{ color: "var(--theme-text-muted)" }}>{labels[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {categoryStats.length > 0 && (
        <div className="rounded-2xl border p-4 mb-6" style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}>
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: "var(--theme-text-muted)" }}>🗂 Per categoria</h2>
          <div className="space-y-2.5">
            {categoryStats.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-[#ede9ff]">{c.name}</span>
                  <span style={{ color: "var(--theme-text-muted)" }}>{c.completed}/{c.total}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--theme-bg)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.round((c.total / categoryStats[0].total) * 100)}%`, backgroundColor: c.color + "99" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewards */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">
          💎 Trofei{" "}
          <span className="text-[#6b5a9e] font-normal">({user.userRewards.length})</span>
        </h2>

        {user.userRewards.length === 0 ? (
          <div className="rounded-2xl border p-6 text-center" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
            <div className="text-3xl mb-2">🏆</div>
            <p className="text-sm" style={{color: "var(--theme-text-muted)"}}>Completa missioni per sbloccare trofei</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {user.userRewards.map((ur) => (
              <div
                key={ur.id}
                className="rounded-2xl border p-4"
                style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}
              >
                <div className="text-3xl mb-2">{ur.reward.icon}</div>
                <div className="font-semibold text-[#ede9ff] text-sm">{ur.reward.name}</div>
                <div className="text-xs text-[#9d8ac7] mt-0.5">{ur.reward.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hero Class */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider">🧬 Classe Eroe</h2>
          <button
            onClick={() => setClassExpanded(!classExpanded)}
            className="text-xs font-semibold px-3 py-1 rounded-lg border transition-colors"
            style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)", background: "var(--theme-surface)" }}
          >
            {classExpanded ? "Annulla" : "Cambia"}
          </button>
        </div>

        {/* Current class display */}
        {heroClass && !classExpanded && (() => {
          const cls = getClassDef(heroClass);
          const currentTier = getLevel(user.points, heroClass);
          return (
            <div
              className="rounded-2xl border p-4 flex items-center gap-4"
              style={{ background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)" }}
            >
              <span className="text-3xl flex-shrink-0">{cls.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#ede9ff]">{cls.name}</p>
                <p className="text-xs" style={{ color: "var(--theme-text-muted)" }}>{cls.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg">{currentTier.icon}</p>
                <p className="text-xs font-semibold text-amber-400">{currentTier.label}</p>
              </div>
            </div>
          );
        })()}

        {/* Class picker grid */}
        {classExpanded && (
          <div className="space-y-4">
            {CLASS_GROUPS.map((group) => {
              const groupClasses = CLASSES.filter((c) => c.group === group.key);
              return (
                <div key={group.key}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--theme-text-muted)" }}>
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {groupClasses.map((cls) => {
                      const isSelected = heroClass === cls.key;
                      return (
                        <button
                          key={cls.key}
                          onClick={() => !savingClass && saveClass(cls.key)}
                          disabled={savingClass}
                          className="rounded-2xl border p-3 text-center transition-all active:scale-95 disabled:opacity-50"
                          style={{
                            background: isSelected ? group.color + "18" : "var(--theme-surface)",
                            borderColor: isSelected ? group.color : "var(--theme-surface-border)",
                            boxShadow: isSelected ? `0 0 0 1px ${group.color}` : "none",
                          }}
                        >
                          <div className="text-2xl mb-1">{cls.icon}</div>
                          <p className="text-xs font-bold text-[#ede9ff] leading-tight">{cls.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Theme picker */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-[#9d8ac7] mb-3 uppercase tracking-wider">🎨 Tema Eroe</h2>
        <div className="grid grid-cols-2 gap-3">
          {(Object.values(THEMES) as (typeof THEMES)[ThemeKey][]).map((t) => (
            <button
              key={t.key}
              onClick={() => { setTheme(t.key as ThemeKey); updateTheme(t.key); }}
              className="flex items-center gap-3 p-3 rounded-2xl border transition-all"
              style={{
                borderColor: theme === t.key ? t.accent : "var(--theme-surface-border)",
                background: theme === t.key ? t.accent + "22" : "var(--theme-surface)",
              }}
            >
              <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: t.bar }} />
              <span className={`text-sm font-medium ${theme === t.key ? "text-[#ede9ff]" : "text-[#6b5a9e]"}`}>
                {t.name}
              </span>
              {theme === t.key && <span className="ml-auto text-xs" style={{color: t.accent}}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Daily reminder */}
      <div className="rounded-2xl border p-5 mb-6" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider mb-3">⏰ Promemoria Giornaliero</h2>

        {notifPermission === "denied" ? (
          <p className="text-xs text-red-400">Notifiche bloccate dal browser. Abilitale nelle impostazioni del browser per usare i promemoria.</p>
        ) : notifPermission !== "granted" ? (
          <div>
            <p className="text-xs text-[#6b5a9e] mb-3">Ricevi un promemoria giornaliero per mantenere la tua serie attiva.</p>
            <button
              onClick={requestNotifPermission}
              disabled={notifRequesting}
              className="w-full py-2.5 border border-amber-700/40 text-amber-400 rounded-xl text-sm font-medium hover:bg-amber-900/10 transition-colors disabled:opacity-50"
            >
              {notifRequesting ? "..." : "🔔 Attiva notifiche"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#ede9ff]">Promemoria giornaliero</span>
              <button
                onClick={() => toggleReminder(!notifEnabled)}
                className="w-11 h-6 rounded-full transition-colors relative"
                style={{background: notifEnabled ? "var(--theme-accent)" : "var(--theme-surface-border)"}}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifEnabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            {notifEnabled && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#9d8ac7]">Ricordami alle</span>
                <input
                  type="time"
                  value={notifTime}
                  onChange={(e) => saveReminderTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-[#ede9ff] text-sm focus:outline-none border"
                  style={{background: "var(--theme-bg, #0f0d22)", borderColor: "var(--theme-surface-border)"}}
                />
              </div>
            )}
            <p className="text-xs text-[#4a3a7a]">Funziona mentre l&apos;app è aperta nel browser.</p>
          </div>
        )}
      </div>

      {/* Push notifications */}
      <div className="rounded-2xl border p-5 mb-6" style={{background: "var(--theme-surface)", borderColor: "var(--theme-surface-border)"}}>
        <h2 className="text-sm font-semibold text-[#9d8ac7] uppercase tracking-wider mb-3">📱 Notifiche Push</h2>
        <p className="text-xs mb-3" style={{ color: "var(--theme-text-muted)" }}>Ricevi promemoria missioni anche quando l&apos;app è chiusa.</p>
        <NotificationButton />
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-900/30 p-5 mb-4" style={{background: "var(--theme-surface)"}}>
        <h2 className="text-sm font-semibold text-red-400/80 uppercase tracking-wider mb-4">⚠️ Zona pericolosa</h2>

        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-2.5 border border-red-900/50 text-red-400 rounded-xl text-sm font-medium hover:bg-red-950/30 transition-colors"
          >
            Elimina tutte le missioni
          </button>
        ) : (
          <div>
            <p className="text-sm text-[#c4b5fd] mb-3">
              Questo eliminerà definitivamente tutte le tue missioni, milestone e dati. Sei sicuro?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border" style={{borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)"}}
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  setResetting(true);
                  await fetch("/api/goals/all", { method: "DELETE" });
                  setResetting(false);
                  setConfirmReset(false);
                  window.location.reload();
                }}
                disabled={resetting}
                className="flex-1 py-2.5 bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
              >
                {resetting ? "Eliminando..." : "Sì, elimina tutto"}
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-red-900/20 my-4" />

        {!confirmResetRewards ? (
          <button
            onClick={() => setConfirmResetRewards(true)}
            className="w-full py-2.5 border border-red-900/50 text-red-400 rounded-xl text-sm font-medium hover:bg-red-950/30 transition-colors"
          >
            Azzera trofei & XP
          </button>
        ) : (
          <div>
            <p className="text-sm text-[#c4b5fd] mb-3">
              Questo eliminerà tutti i tuoi trofei e azzererà i tuoi XP a 0. Sei sicuro?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmResetRewards(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border" style={{borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)"}}
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  setResettingRewards(true);
                  await fetch("/api/profile/reset-rewards", { method: "DELETE" });
                  setResettingRewards(false);
                  setConfirmResetRewards(false);
                  window.location.reload();
                }}
                disabled={resettingRewards}
                className="flex-1 py-2.5 bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
              >
                {resettingRewards ? "Azzerando..." : "Sì, azzera"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wipe everything */}
      <div className="rounded-2xl border border-red-900/50 p-5 mb-4" style={{background: "var(--theme-surface)"}}>
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-1">💀 Cancella tutto</h2>
        <p className="text-xs text-[#6b5a9e] mb-4">Elimina tutte le missioni, trofei e azzera gli XP a 0. Tabula rasa.</p>

        {!confirmWipeAll ? (
          <button
            onClick={() => setConfirmWipeAll(true)}
            className="w-full py-2.5 bg-red-950/40 border border-red-700/60 text-red-300 rounded-xl text-sm font-semibold hover:bg-red-900/40 transition-colors"
          >
            💀 Cancella tutto
          </button>
        ) : (
          <div>
            <p className="text-sm text-[#c4b5fd] mb-3">
              Questo eliminerà definitivamente TUTTE le missioni, trofei e azzererà gli XP a 0. Non può essere annullato.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmWipeAll(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border" style={{borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)"}}
              >
                Annulla
              </button>
              <button
                onClick={async () => {
                  setWipingAll(true);
                  await fetch("/api/goals/all", { method: "DELETE" });
                  await fetch("/api/profile/reset-rewards", { method: "DELETE" });
                  setWipingAll(false);
                  setConfirmWipeAll(false);
                  window.location.reload();
                }}
                disabled={wipingAll}
                className="flex-1 py-2.5 bg-red-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 active:scale-95 transition-all"
              >
                {wipingAll ? "Cancellando..." : "Sì, cancella tutto"}
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full py-3 border border-red-900/50 text-red-400 rounded-xl font-semibold hover:bg-red-950/30 transition-colors"
      >
        Esci dal regno
      </button>
    </div>
  );
}
