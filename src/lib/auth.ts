import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { consumeLoginTicket } from "@/lib/mobile-auth";

// Payload di https://oauth2.googleapis.com/tokeninfo — l'endpoint valida
// firma e scadenza del token; a noi restano da controllare audience e issuer.
type GoogleTokenInfo = {
  aud?: string;
  iss?: string;
  email?: string;
  email_verified?: string;
  name?: string;
  picture?: string;
};

/**
 * Scambia con Google l'authorization code prodotto dal Sign-In nativo in
 * modalità offline e restituisce l'ID token risultante.
 *
 * Il codice arriva da `requestOfflineAccess` sul client Android ed è legato al
 * client **web**: lo scambio usa quindi client id e secret del client web e non
 * porta `redirect_uri`, che in questo flusso non esiste.
 *
 * Restituisce null su qualsiasi errore: il chiamante nega l'accesso, e l'ID
 * token viene comunque validato a valle come quello del percorso online, così
 * la verifica di audience ed emittente resta una sola.
 */
async function exchangeServerAuthCode(code: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id_token?: string };
    return data.id_token ?? null;
  } catch {
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      checks: ["state"], // PKCE disabled: on Android PWA the code_verifier cookie is not shared between the PWA web view and the Chrome Custom Tab that handles the OAuth redirect, causing the first login attempt to always fail
    }),
    // Login dal guscio Android (Capacitor). Google blocca l'OAuth web dentro
    // le WebView incorporate (disallowed_useragent), quindi l'APK usa il
    // Sign-In nativo e manda qui l'ID token risultante. tokeninfo ne valida
    // firma e scadenza; audience e issuer li controlliamo noi.
    Credentials({
      id: "google-native",
      name: "Google (app Android)",
      credentials: { idToken: {}, serverAuthCode: {} },
      async authorize(credentials) {
        // Il guscio manda l'una o l'altra credenziale a seconda del percorso
        // nativo riuscito: ID token dal Credential Manager, oppure un
        // authorization code dall'API di autorizzazione, che va scambiato.
        let idToken = typeof credentials?.idToken === "string" ? credentials.idToken : "";
        if (!idToken && typeof credentials?.serverAuthCode === "string" && credentials.serverAuthCode) {
          idToken = (await exchangeServerAuthCode(credentials.serverAuthCode)) ?? "";
        }
        if (!idToken) return null;

        const res = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
        );
        if (!res.ok) return null;
        const info = (await res.json()) as GoogleTokenInfo;

        if (info.aud !== process.env.GOOGLE_CLIENT_ID) return null;
        if (info.iss !== "https://accounts.google.com" && info.iss !== "accounts.google.com") return null;
        if (info.email_verified !== "true" || !info.email) return null;

        // Stessa find-or-create del callback signIn del flusso web, così un
        // utente ottiene lo stesso account da APK e da browser.
        let user = await prisma.user.findUnique({ where: { email: info.email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email: info.email, name: info.name ?? null, image: info.picture ?? null },
          });
        }
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    // Login Google dall'APK, seconda via: il guscio apre il browser di
    // sistema (dove l'OAuth web di Google funziona sempre), il server conia
    // un ticket monouso e il deep link lo riporta qui. Consumarlo trasforma
    // la sessione nata nel browser in una sessione della WebView — è il
    // percorso per i dispositivi dove il Credential Manager rifiuta il
    // Sign-In nativo ("[16] Account reauth failed") senza rimedio possibile.
    Credentials({
      id: "ticket",
      name: "Ticket di accesso (app Android)",
      credentials: { ticket: {} },
      async authorize(credentials) {
        const ticket = typeof credentials?.ticket === "string" ? credentials.ticket : "";
        if (!ticket) return null;

        const userId = await consumeLoginTicket(ticket);
        if (!userId) return null;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    // Accesso con email e password: la via che non dipende né da Google né
    // dal salto nel browser. Resta il paracadute quando tutto il resto è
    // fuori uso.
    Credentials({
      id: "password",
      name: "Email e password",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Un account creato via Google non ha password finché non se ne
        // imposta una dal profilo: qui non si distingue "utente inesistente"
        // da "senza password", per non rivelare quali email sono registrate.
        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        try {
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          });
          if (!existing) {
            await prisma.user.create({
              data: { email: user.email, name: user.name ?? null, image: user.image ?? null },
            });
          }
        } catch {
          // DB error — still allow sign-in
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // On first sign-in, resolve the real DB ID from email
      if (user?.email && account?.provider === "google") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          });
          if (dbUser) token.id = dbUser.id;
        } catch {
          // ignore
        }
      } else if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        if (token.id) {
          session.user.id = token.id as string;
        } else if (session.user.email) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: session.user.email },
              select: { id: true },
            });
            if (dbUser) session.user.id = dbUser.id;
          } catch {
            // ignore
          }
        }
      }
      return session;
    },
  },
});
