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
 * Apre il foglio di Sign-In nativo di Google e restituisce l'ID token.
 * Restituisce null se l'utente annulla o se qualcosa fallisce: è il chiamante
 * a decidere il messaggio. Non va mai chiamata fuori dal nativo.
 *
 * Richiede NEXT_PUBLIC_GOOGLE_CLIENT_ID (lo stesso client ID web usato dal
 * server: è l'audience dell'ID token, non un segreto).
 */
export async function nativeGoogleIdToken(): Promise<string | null> {
  const webClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!webClientId) return null;

  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");
    await SocialLogin.initialize({ google: { webClientId } });
    const { result } = await SocialLogin.login({ provider: "google", options: {} });
    if ("idToken" in result && result.idToken) return result.idToken;
    return null;
  } catch {
    return null;
  }
}
