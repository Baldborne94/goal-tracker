"use client";

// Ponte verso Health Connect. Gira solo dentro il guscio Android (Capacitor):
// una PWA nel browser NON può accedere a Health Connect, quindi ogni funzione
// qui degrada a un no-op esplicito quando non siamo su piattaforma nativa.
//
// Il plugin è importato dinamicamente per non finire nel bundle del browser.

import { METRICS, type RawSample } from "./health";

export type HealthAvailability =
  | { available: true }
  | { available: false; reason: "web" | "unavailable"; message: string };

export type ReadResult = {
  samples: RawSample[];
  /** Metriche per cui il permesso è stato negato o il provider non ha dati. */
  missing: string[];
  /** Metriche che hanno sollevato un errore: mostrate come "dato assente". */
  failed: { metric: string; error: string }[];
};

type CapgoHealth = {
  isAvailable(): Promise<{ available: boolean; reason?: string }>;
  requestAuthorization(o: { read?: string[]; requestHistoryAccess?: boolean }): Promise<{
    readAuthorized: string[];
    readDenied: string[];
  }>;
  checkAuthorization(o: { read?: string[] }): Promise<{ readAuthorized: string[]; readDenied: string[] }>;
  readSamples(o: { dataType: string; startDate?: string; endDate?: string; limit?: number; ascending?: boolean }): Promise<{
    samples: RawSample[];
  }>;
  queryWorkouts(o: { startDate?: string; endDate?: string; limit?: number }): Promise<{ workouts: Record<string, unknown>[] }>;
  openHealthConnectSettings(): Promise<void>;
};

async function loadPlugin(): Promise<{ native: boolean; health: CapgoHealth | null }> {
  if (typeof window === "undefined") return { native: false, health: null };
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return { native: false, health: null };
    const mod = await import("@capgo/capacitor-health");
    return { native: true, health: mod.Health as unknown as CapgoHealth };
  } catch {
    return { native: false, health: null };
  }
}

/** True solo dentro l'app Android/iOS, false nel browser. */
export async function isNativeApp(): Promise<boolean> {
  const { native } = await loadPlugin();
  return native;
}

export async function checkAvailability(): Promise<HealthAvailability> {
  const { native, health } = await loadPlugin();
  if (!native || !health) {
    return {
      available: false,
      reason: "web",
      message: "Health Connect è raggiungibile solo dall'app Android. Nel browser puoi consultare i dati già sincronizzati.",
    };
  }
  try {
    const res = await health.isAvailable();
    if (res.available) return { available: true };
    return {
      available: false,
      reason: "unavailable",
      message: res.reason || "Health Connect non è installato o non è disponibile su questo dispositivo.",
    };
  } catch (e) {
    return { available: false, reason: "unavailable", message: (e as Error).message };
  }
}

const READ_TYPES = METRICS.map((m) => m.key);

/** Apre il foglio dei permessi di Health Connect. Va chiamata da un gesto utente. */
export async function requestPermissions(): Promise<{ granted: string[]; denied: string[] }> {
  const { health } = await loadPlugin();
  if (!health) return { granted: [], denied: READ_TYPES };
  // requestHistoryAccess permette di leggere oltre gli ultimi 30 giorni;
  // sui provider troppo vecchi viene ignorato senza far fallire la richiesta.
  const res = await health.requestAuthorization({ read: READ_TYPES, requestHistoryAccess: true });
  return { granted: res.readAuthorized ?? [], denied: res.readDenied ?? [] };
}

export async function openHealthConnectSettings(): Promise<void> {
  const { health } = await loadPlugin();
  await health?.openHealthConnectSettings();
}

/**
 * Legge tutte le metriche dichiarate nel registro.
 *
 * La sincronizzazione non è realtime per scelta: si legge all'apertura della
 * schermata o con il pulsante di refresh, mai in streaming.
 *
 * Una metrica che fallisce (permesso negato, provider che non scrive quel dato
 * — è il caso noto di HRV e battito a riposo su Samsung Health) non interrompe
 * le altre: finisce in `failed` e la UI la mostra come dato assente.
 */
export async function readAllMetrics(days = 30): Promise<ReadResult> {
  const { health } = await loadPlugin();
  if (!health) return { samples: [], missing: READ_TYPES, failed: [] };

  const endDate = new Date();
  const samples: RawSample[] = [];
  const missing: string[] = [];
  const failed: { metric: string; error: string }[] = [];

  let authorized: Set<string>;
  try {
    const status = await health.checkAuthorization({ read: READ_TYPES });
    authorized = new Set(status.readAuthorized ?? []);
  } catch {
    authorized = new Set(READ_TYPES);
  }

  for (const metric of METRICS) {
    if (!authorized.has(metric.key)) {
      missing.push(metric.key);
      continue;
    }

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - Math.min(days, metric.historyDays));

    try {
      if (metric.key === "workouts") {
        const res = await health.queryWorkouts({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 200,
        });
        for (const w of res.workouts ?? []) {
          // Le sessioni tornano con la durata in secondi: la portiamo a minuti,
          // l'unità in cui la metrica "workouts" è dichiarata nel registro.
          samples.push({
            dataType: "workouts",
            value: (Number(w.duration) || 0) / 60,
            unit: "minute",
            startDate: String(w.startDate),
            endDate: w.endDate ? String(w.endDate) : undefined,
            sourceName: w.sourceName ? String(w.sourceName) : undefined,
            platformId: w.platformId ? String(w.platformId) : undefined,
            workoutType: w.workoutType ? String(w.workoutType) : undefined,
            totalEnergyBurned: Number(w.totalEnergyBurned) || undefined,
            totalDistance: Number(w.totalDistance) || undefined,
          });
        }
        continue;
      }

      // Sempre readSamples, mai le query aggregate: su Health Connect le
      // aggregazioni non restituiscono le fasi del sonno.
      const res = await health.readSamples({
        dataType: metric.key,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 2000,
        ascending: true,
      });
      if (!res.samples?.length) missing.push(metric.key);
      else samples.push(...res.samples);
    } catch (e) {
      failed.push({ metric: metric.key, error: (e as Error).message ?? "errore sconosciuto" });
    }
  }

  return { samples, missing, failed };
}
