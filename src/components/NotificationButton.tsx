"use client";

import { useEffect, useState } from "react";
import { canUseNativePush, isNativeShell, registerNativePush, saveNativePushToken } from "@/lib/capacitor-push";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output.buffer;
}

type Status = "unsupported" | "default" | "granted" | "denied" | "loading" | "sending";

export default function NotificationButton() {
  const [status, setStatus] = useState<Status>("loading");
  const [testResult, setTestResult] = useState<string | null>(null);

  // Cosa vede davvero l'app: un solo accertamento, invece di due stati che
  // devono mettersi d'accordo fra loro. Quando qualcosa non funziona, questi
  // tre valori sono la diagnosi — e vengono mostrati, perché "non supportate"
  // non dice a nessuno dove guardare.
  const [env, setEnv] = useState<{ native: boolean; plugin: boolean; timedOut?: boolean } | null>(null);
  const native = env?.plugin === true;
  const staleShell = env?.native === true && env.plugin === false;

  useEffect(() => {
    let settled = false;
    const settle = (value: { native: boolean; plugin: boolean; timedOut?: boolean }) => {
      if (settled) return;
      settled = true;
      setEnv(value);
      if (value.plugin) setStatus("default");
    };

    // Il rilevamento interroga il ponte nativo, e un ponte che non risponde
    // non risponde per sempre: senza questo tetto la schermata restava a
    // "Verifica stato notifiche…" e non si poteva toccare niente. Meglio una
    // risposta incerta ma detta, che una certezza che non arriva mai.
    const timer = setTimeout(() => settle({ native: false, plugin: false, timedOut: true }), 3000);

    void (async () => {
      try {
        const [plugin, shell] = await Promise.all([canUseNativePush(), isNativeShell()]);
        settle({ native: shell, plugin });
      } catch {
        settle({ native: false, plugin: false });
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (env === null || native) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    setStatus(Notification.permission as Status);

    // If already granted, ensure subscription is saved
    if (Notification.permission === "granted") {
      ensureSubscribed().catch(() => {});
    }

    // Re-read permission when the PWA returns to the foreground: the user may
    // have unblocked notifications in the OS/site settings while the app was
    // backgrounded, so the cached "denied" state would otherwise stay stale.
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      setStatus(Notification.permission as Status);
      if (Notification.permission === "granted") ensureSubscribed().catch(() => {});
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [env, native]);

  async function ensureSubscribed() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), timezone }),
    });
  }

  async function enableNotifications() {
    // Anche quando il rilevamento dice di no: se il plugin c'è davvero, la
    // registrazione riesce; se non c'è, torna un motivo leggibile invece del
    // silenzio.
    if (native || env?.native || env?.timedOut) {
      setStatus("loading");
      const result = await registerNativePush();
      if (!result.ok) {
        setStatus(result.reason === "denied" ? "denied" : "default");
        setTestResult(
          result.reason === "denied"
            ? "🚫 Permesso negato. Puoi concederlo dalle impostazioni di Android."
            : `⚠️ Registrazione non riuscita.${result.detail ? ` ${result.detail}` : ""}`
        );
        return;
      }
      const saved = await saveNativePushToken(result.token);
      setStatus(saved ? "granted" : "default");
      setTestResult(
        saved
          ? "✅ Notifiche attivate! Arriveranno anche ad app chiusa."
          : "⚠️ Token ottenuto ma non salvato sul server. Riprova."
      );
      return;
    }

    if (!("Notification" in window)) return;
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission as Status);
      if (permission === "granted") {
        await ensureSubscribed();
        setTestResult("✅ Notifiche attivate! Riceverai promemoria agli orari delle tue missioni.");
      }
    } catch {
      setStatus("default");
    }
  }

  async function sendTest() {
    setStatus("sending");
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.sent > 0) {
      setTestResult("📱 Test inviato! Controlla il pannello notifiche.");
    } else if (data.error) {
      setTestResult(`⚠️ ${data.error}`);
    } else {
      setTestResult("⚠️ Inviato ma senza conferma — controlla le notifiche di Chrome nelle impostazioni.");
    }
    setStatus("granted");
  }

  if (status === "unsupported") {
    return (
      <div
        className="rounded-xl border p-3 text-xs leading-relaxed space-y-2"
        style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
      >
        {staleShell ? (
          <p>
            📲 Questa versione dell&apos;app non sa ancora ricevere le notifiche: il
            pezzo che serve è codice nativo e arriva solo con un APK nuovo.
            Installa l&apos;ultima versione sopra a questa — non serve disinstallare nulla.
          </p>
        ) : (
          <p>🔕 Notifiche push non disponibili qui.</p>
        )}
        {/* Un pulsante c'è comunque: il rilevamento può sbagliarsi o non
            rispondere, e un tentativo vero produce un errore vero — che vale
            più di una diagnosi fatta da fuori. */}
        <button
          onClick={enableNotifications}
          className="w-full py-2.5 rounded-xl font-semibold text-xs border border-amber-500/40 text-amber-400 active:scale-95 transition-all"
        >
          Prova comunque ad attivarle
        </button>

        {/* La diagnosi, non l'esito: così un problema si legge in un colpo
            d'occhio invece di doverlo indovinare da fuori. */}
        <p className="font-mono text-[10px] opacity-70">
          app nativa: {env?.native ? "sì" : "no"} · plugin push:{" "}
          {env?.plugin ? "sì" : "no"} · web push:{" "}
          {typeof window !== "undefined" && "PushManager" in window ? "sì" : "no"}
          {env?.timedOut ? " · ponte nativo: nessuna risposta" : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {status === "loading" && (
        <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>
          Verifica stato notifiche...
        </div>
      )}

      {status === "denied" && (
        <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-3 text-xs text-red-400">
          🚫 Notifiche bloccate.{" "}
          {native
            ? "Riattivale da Impostazioni Android → App → Goal Tracker → Notifiche."
            : "Vai su Chrome → Impostazioni sito → Notifiche → Consenti per questo sito."}
        </div>
      )}

      {(status === "default") && (
        <button
          onClick={enableNotifications}
          className="w-full py-3 rounded-xl font-semibold text-sm border border-amber-500/40 text-amber-400 hover:bg-amber-900/10 active:scale-95 transition-all"
        >
          🔔 Attiva notifiche push
        </button>
      )}

      {(status === "granted" || status === "sending") && (
        <div className="space-y-2">
          <div className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: "var(--theme-surface-border)" }}>
            <span className="text-sm text-green-400 font-medium">✅ Notifiche attive</span>
            <button
              onClick={sendTest}
              disabled={status === "sending"}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium active:scale-95 transition-all disabled:opacity-50"
              style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}
            >
              {status === "sending" ? "Invio..." : "Invia test"}
            </button>
          </div>
        </div>
      )}

      {testResult && (
        <p className="text-xs px-1" style={{ color: "var(--theme-text-muted)" }}>{testResult}</p>
      )}
    </div>
  );
}
