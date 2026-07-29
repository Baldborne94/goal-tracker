"use client";

// Notifiche push dentro l'APK.
//
// Il WebView di Android non espone l'API Push del browser: `PushManager` non
// esiste, quindi il percorso Web Push (che nel browser funziona benissimo) lì
// dentro non parte nemmeno. La via nativa è Firebase Cloud Messaging, dove la
// connessione la tiene il sistema operativo — ed è per questo che la notifica
// arriva anche ad app chiusa.
//
// Fuori dal nativo tutto degrada a no-op: il browser continua col Web Push.

export type PushRegistration =
  | { ok: true; token: string }
  | { ok: false; reason: "web" | "unavailable" | "denied" | "error"; detail?: string };

async function loadPlugin() {
  if (typeof window === "undefined") return null;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    if (!Capacitor.isPluginAvailable("PushNotifications")) return null;
    const { PushNotifications } = await import("@capacitor/push-notifications");
    return PushNotifications;
  } catch {
    return null;
  }
}

/** True se questo guscio sa parlare con FCM (gli APK vecchi non hanno il plugin). */
export async function canUseNativePush(): Promise<boolean> {
  return (await loadPlugin()) !== null;
}

/**
 * Chiede il permesso, registra il dispositivo e restituisce il token FCM.
 *
 * Va chiamata da un gesto dell'utente: da Android 13 il permesso per le
 * notifiche è una richiesta esplicita come le altre.
 *
 * Il token arriva per evento, non come valore di ritorno della `register()`,
 * quindi si aspetta l'evento — con un tetto di tempo, perché se il
 * dispositivo non riesce a raggiungere Firebase quell'evento non arriva mai
 * e l'attesa resterebbe appesa per sempre.
 */
export async function registerNativePush(timeoutMs = 15000): Promise<PushRegistration> {
  const push = await loadPlugin();
  if (!push) return { ok: false, reason: "web" };

  try {
    let status = await push.checkPermissions();
    if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
      status = await push.requestPermissions();
    }
    if (status.receive !== "granted") return { ok: false, reason: "denied" };

    const token = await new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const timer = setTimeout(() => finish(null), timeoutMs);

      void push.addListener("registration", (t) => {
        clearTimeout(timer);
        finish(t.value);
      });
      void push.addListener("registrationError", () => {
        clearTimeout(timer);
        finish(null);
      });

      void push.register();
    });

    if (!token) return { ok: false, reason: "unavailable", detail: "Nessun token da Firebase entro il tempo massimo." };
    return { ok: true, token };
  } catch (e) {
    return { ok: false, reason: "error", detail: (e as Error).message };
  }
}

/** Manda il token al server, che lo salva accanto alle iscrizioni del browser. */
export async function saveNativePushToken(token: string): Promise<boolean> {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fcmToken: token, timezone }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
