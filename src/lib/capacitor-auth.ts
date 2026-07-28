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

export type NativeGoogleResult =
  | { ok: true; idToken: string }
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

  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({ google: { webClientId } });
    const { result } = await SocialLogin.login({ provider: "google", options: {} });
    if ("idToken" in result && result.idToken) return { ok: true, idToken: result.idToken };
    return {
      ok: false,
      reason: "error",
      detail: `Il plugin non ha restituito un ID token (responseType: ${"responseType" in result ? result.responseType : "sconosciuto"}).`,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason: isUserCancellation(detail) ? "cancelled" : "error",
      detail,
    };
  }
}
