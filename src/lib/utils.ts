import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Il giorno dell'utente ───────────────────────────────────────────────
//
// `toISOString().slice(0,10)` restituisce la data UTC, non quella di chi usa
// l'app: in Italia, fra mezzanotte e le due (l'ora legale sposta di +02:00),
// scriveva ancora il giorno prima. Un check-in dell'una di notte finiva su
// ieri, lo streak perdeva un giorno, il pasto registrato a mezzanotte e
// mezza spariva dal conteggio di oggi.
//
// Regola: il giorno appartiene a chi vive la giornata.
//  - sul CLIENT si usa il fuso del dispositivo, che è quello vero;
//  - sul SERVER non esiste un "locale", quindi si usa il fuso dell'app
//    (APP_TIMEZONE, default Europe/Rome) — il server di Vercel gira in UTC.

export const APP_TIME_ZONE = process.env.APP_TIMEZONE || "Europe/Rome";

/** Scarto fra il fuso indicato e UTC, per quell'istante (gestisce l'ora legale). */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // `hour` può valere 24 a mezzanotte con hour12:false su alcuni runtime.
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - date.getTime();
}

/**
 * "YYYY-MM-DD" del giorno in cui quell'istante cade.
 * Senza `timeZone` usa il fuso locale del runtime (il dispositivo, sul client).
 */
export function dayKey(date: Date = new Date(), timeZone?: string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  if (timeZone) {
    // en-CA formatta nativamente come YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Il giorno "di oggi" lato server, nel fuso dell'app. */
export function serverDayKey(date: Date = new Date()): string {
  return dayKey(date, APP_TIME_ZONE);
}

/**
 * Istanti di inizio e fine del giorno, per le query su colonne DateTime
 * (`completedAt`, `createdAt`). Anche qui il confine è quello dell'utente:
 * `setHours(0,0,0,0)` su un server UTC tagliava alle 02:00 italiane.
 */
export function dayRange(date: Date = new Date(), timeZone: string = APP_TIME_ZONE): { start: Date; end: Date } {
  const key = dayKey(date, timeZone);
  const midnightUtc = new Date(`${key}T00:00:00.000Z`);
  const start = new Date(midnightUtc.getTime() - zoneOffsetMs(midnightUtc, timeZone));
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getProgressColor(progress: number) {
  if (progress >= 100) return "bg-green-500";
  if (progress >= 60) return "bg-blue-500";
  if (progress >= 30) return "bg-yellow-500";
  return "bg-red-400";
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "text-red-500 bg-red-50";
    case "medium":
      return "text-yellow-600 bg-yellow-50";
    case "low":
      return "text-green-600 bg-green-50";
    default:
      return "text-gray-500 bg-gray-50";
  }
}

export function getPriorityLabel(priority: string) {
  switch (priority) {
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    case "low":
      return "Bassa";
    default:
      return priority;
  }
}

/**
 * Giorni consecutivi con almeno un'attività, a ritroso da oggi.
 *
 * I giorni si contano nel fuso dell'utente: una milestone completata all'una
 * di notte appartiene a quel giorno lì, non a quello prima.
 */
export function calculateStreak(completedDates: (Date | null)[], timeZone: string = APP_TIME_ZONE): number {
  const dates = new Set(
    completedDates
      .filter((d): d is Date => d !== null)
      .map((d) => dayKey(new Date(d), timeZone))
  );

  const checkDate = new Date();
  if (!dates.has(dayKey(checkDate, timeZone))) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(dayKey(checkDate, timeZone))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}
