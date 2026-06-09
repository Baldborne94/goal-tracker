"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
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
  }, []);

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
      <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--theme-surface-border)", color: "var(--theme-text-muted)" }}>
        🔕 Notifiche push non supportate in questo browser.
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
          🚫 Notifiche bloccate. Vai su Chrome → Impostazioni sito → Notifiche → Consenti per questo sito.
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
