// L'invio delle notifiche, un posto solo.
//
// Ci sono due corrieri, perché ci sono due destinatari diversi:
//
//  - il BROWSER usa il Web Push standard (VAPID): endpoint + chiavi di
//    cifratura, la pagina decifra e mostra;
//  - l'APK usa Firebase Cloud Messaging, perché il WebView di Android non
//    espone l'API Push del browser. Lì la connessione la tiene il sistema
//    operativo, ed è anche il motivo per cui la notifica arriva ad app chiusa.
//
// Chi chiama non deve sapere quale dei due serve: passa il messaggio e le
// iscrizioni, e questo modulo smista.

import { prisma } from "./db";
import { getWebPush } from "./vapid";

export type PushMessage = {
  title: string;
  body: string;
  tag: string;
};

export type PushTarget = {
  kind: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

// ── Firebase Admin ──────────────────────────────────────────────────────

type FirebaseMessaging = {
  send(message: {
    token: string;
    notification: { title: string; body: string };
    android?: { priority?: "normal" | "high"; notification?: { tag?: string; icon?: string } };
    data?: Record<string, string>;
  }): Promise<string>;
};

let messagingCache: FirebaseMessaging | null | undefined;

/**
 * Inizializza Firebase Admin dalla chiave di servizio.
 *
 * Restituisce null se la variabile non c'è, invece di lanciare: senza FCM
 * il Web Push del browser deve continuare a funzionare — è già così che
 * l'app vive oggi, e una configurazione a metà non deve spegnere tutto.
 */
async function getMessaging(): Promise<FirebaseMessaging | null> {
  if (messagingCache !== undefined) return messagingCache;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    messagingCache = null;
    return null;
  }

  try {
    const credentials = JSON.parse(raw);
    const admin = await import("firebase-admin/app");
    const messaging = await import("firebase-admin/messaging");

    const app =
      admin.getApps().length > 0
        ? admin.getApps()[0]
        : admin.initializeApp({ credential: admin.cert(credentials) });

    messagingCache = messaging.getMessaging(app) as unknown as FirebaseMessaging;
  } catch (err) {
    console.error("[push] Firebase Admin non inizializzabile", err);
    messagingCache = null;
  }

  return messagingCache;
}

/** True quando l'invio verso l'APK è configurato. */
export async function isFcmReady(): Promise<boolean> {
  return (await getMessaging()) !== null;
}

// ── Invio ───────────────────────────────────────────────────────────────

/** Un'iscrizione morta va tolta, o consuma un invio a ogni giro per sempre. */
async function drop(endpoint: string) {
  await prisma.pushSubscription.delete({ where: { endpoint } }).catch(() => {});
}

async function sendWeb(target: PushTarget, message: PushMessage): Promise<boolean> {
  if (!target.p256dh || !target.auth) return false;
  try {
    const webpush = getWebPush();
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message)
    );
    return true;
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "statusCode" in err ? (err as { statusCode: number }).statusCode : 0;
    console.error(`[push] web fallito …${target.endpoint.slice(-20)} status=${status}`, err);
    if (status === 404 || status === 410) await drop(target.endpoint);
    return false;
  }
}

async function sendFcm(target: PushTarget, message: PushMessage): Promise<boolean> {
  const messaging = await getMessaging();
  if (!messaging) return false;

  try {
    await messaging.send({
      token: target.endpoint,
      notification: { title: message.title, body: message.body },
      // `high` perché sono promemoria a orario: con priorità normale Android
      // può accorparli e consegnarli quando gli fa comodo.
      android: { priority: "high", notification: { tag: message.tag } },
      data: { tag: message.tag },
    });
    return true;
  } catch (err: unknown) {
    const code =
      err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    console.error(`[push] fcm fallito …${target.endpoint.slice(-12)} code=${code}`, err);
    // Il token è stato revocato (app disinstallata, dati cancellati): non
    // tornerà valido, quindi si toglie.
    if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
      await drop(target.endpoint);
    }
    return false;
  }
}

/** Manda a tutte le iscrizioni date, ognuna col suo corriere. Ritorna quante sono partite. */
export async function sendPush(targets: PushTarget[], message: PushMessage): Promise<number> {
  let sent = 0;
  for (const target of targets) {
    const ok = target.kind === "fcm" ? await sendFcm(target, message) : await sendWeb(target, message);
    if (ok) sent++;
  }
  return sent;
}
