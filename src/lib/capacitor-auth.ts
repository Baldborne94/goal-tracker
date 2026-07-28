"use client";

// Login Google per il guscio Android.
//
// Google rifiuta i flussi OAuth dentro le WebView incorporate
// (errore "disallowed_useragent"), quindi dentro l'APK il redirect web di
// NextAuth non è percorribile. Qui si usa il Sign-In nativo (Credential
// Manager) via @capgo/capacitor-social-login: il plugin restituisce un ID
// token che il server verifica nel provider "google-native" di NextAuth.
// La sessione nasce da una fetch same-origin, quindi il cookie finisce nel
// posto giusto — la WebView — senza il problema di isolamento dei cookie
// delle Custom Tab.
//
// Fuori dal nativo tutte le funzioni sono no-op: il browser usa il normale
// flusso OAuth web.

export async function isNativePlatform(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Il flusso nativo può consegnare due credenziali diverse a seconda della
 * strada che riesce a percorrere:
 * - `idToken` dal Credential Manager (modalità online), verificabile subito;
 * - `serverAuthCode` dall'API di autorizzazione (modalità offline), che il
 *   server deve scambiare con Google per ottenere l'identità.
 */
export type NativeGoogleResult =
  | { ok: true; idToken: string; serverAuthCode?: undefined }
  | { ok: true; serverAuthCode: string; idToken?: undefined }
  | { ok: false; reason: "cancelled" | "config" | "error"; detail: string };

/** L'annullamento dell'utente non è un guasto: va riconosciuto per non mostrare diagnostica inutile. */
function isUserCancellation(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("cancel") || m.includes("annull") || m.includes("13:") || m.includes("user closed");
}

/**
 * Apre il foglio di Sign-In nativo di Google e restituisce l'ID token.
 * Non va mai chiamata fuori dal nativo.
 *
 * Il motivo del fallimento viene sempre riportato al chiamante: questo flusso
 * dipende da tre configurazioni esterne (variabile d'ambiente, client OAuth
 * Android con la SHA-1 giusta, firma dell'APK) e un errore generico non
 * permette di capire quale delle tre è rotta.
 *
 * Richiede NEXT_PUBLIC_GOOGLE_CLIENT_ID: dev'essere il client ID **web** (fa
 * da audience dell'ID token), non quello Android.
 */
export async function nativeGoogleIdToken(): Promise<NativeGoogleResult> {
  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!webClientId) {
    return {
      ok: false,
      reason: "config",
      detail: "NEXT_PUBLIC_GOOGLE_CLIENT_ID assente nel deploy: aggiungila su Vercel e ridistribuisci.",
    };
  }

  // Il client ID è pubblico per costruzione (viaggia nel bundle e dentro l'ID
  // token come `aud`): mostrarne il prefisso negli errori distingue subito il
  // caso "in NEXT_PUBLIC_GOOGLE_CLIENT_ID è finito il client Android invece di
  // quello web", che altrimenti è indistinguibile da un guasto del dispositivo.
  const idHint = `client: ${webClientId.slice(0, 24)}…`;

  // Prima si tenta la modalità online (Credential Manager): è la più diretta e
  // restituisce subito un ID token. Su alcuni dispositivi però fallisce con
  // "[16] Account reauth failed" anche a configurazione OAuth corretta, e nulla
  // lato app può rimediare. In quel caso si ripiega sulla modalità offline, che
  // usa l'API di autorizzazione di Google — un percorso diverso, che non tocca
  // il Credential Manager — e restituisce un authorization code.
  const online = await attempt("online", webClientId);
  if (online.ok || online.reason === "cancelled") return online;

  const offline = await attempt("offline", webClientId);
  if (offline.ok || offline.reason === "cancelled") return offline;

  // Entrambe fallite: si riportano tutte e due, perché i due percorsi falliscono
  // per ragioni diverse e vedere una sola metà porta fuori strada.
  return {
    ok: false,
    reason: "error",
    detail: `online: ${online.detail} | offline: ${offline.detail} — ${idHint}`,
  };
}

async function attempt(
  mode: "online" | "offline",
  webClientId: string
): Promise<NativeGoogleResult> {
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({ google: { webClientId, mode } });
    const { result } = await SocialLogin.login({ provider: "google", options: {} });

    if ("idToken" in result && result.idToken) return { ok: true, idToken: result.idToken };
    if ("serverAuthCode" in result && result.serverAuthCode) {
      return { ok: true, serverAuthCode: result.serverAuthCode };
    }

    return {
      ok: false,
      reason: "error",
      detail: `nessuna credenziale (responseType: ${"responseType" in result ? result.responseType : "sconosciuto"})`,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: isUserCancellation(raw) ? "cancelled" : "error", detail: raw };
  }
}
