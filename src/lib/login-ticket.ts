// Ticket di accesso monouso per il login Google dall'APK.
//
// Il Credential Manager di Google su alcuni dispositivi rifiuta il Sign-In
// nativo ("[16] Account reauth failed") a configurazione OAuth perfettamente
// corretta, e l'OAuth web dentro la WebView è vietato da Google
// (disallowed_useragent). La via che resta è il browser di sistema, dove
// l'OAuth web funziona sempre — ma i cookie del browser non sono quelli della
// WebView, quindi la sessione va traghettata: il server conia un ticket
// usa-e-getta legato all'utente appena autenticato, il browser rimbalza sul
// deep link `goaltracker://login?ticket=…`, l'app lo consuma con una fetch
// same-origin e il cookie di sessione nasce nel posto giusto.
//
// Questo modulo è il contratto fra i due lati: schema del deep link e formato
// del ticket. Solo funzioni pure e niente import Node — lo carica anche il
// bundle client. La parte server (conio, hash, consumo) sta in
// `mobile-auth.ts`.

/** Schema/host registrati nell'intent-filter di MainActivity. */
export const LOGIN_DEEP_LINK_BASE = "goaltracker://login";

/**
 * Vita del ticket: deve coprire solo il salto browser → app, che è questione
 * di secondi. Due minuti tengono conto del foglio "Apri con…" di Android e di
 * un utente che si distrae, senza lasciare in giro credenziali durevoli.
 */
export const TICKET_TTL_MS = 2 * 60 * 1000;

/** 32 byte casuali in esadecimale: il formato è parte del contratto. */
const TICKET_RE = /^[a-f0-9]{64}$/;

export function isValidTicketFormat(ticket: string): boolean {
  return TICKET_RE.test(ticket);
}

export function buildLoginDeepLink(ticket: string): string {
  return `${LOGIN_DEEP_LINK_BASE}?ticket=${ticket}`;
}

/**
 * Estrae il ticket da un deep link, o null se l'URL non è il nostro.
 *
 * Niente `new URL()`: il parsing degli schemi custom non è uniforme tra i
 * WebView Android, e un'espressione regolare su un formato che controlliamo
 * noi è più prevedibile di un parser che potrebbe trattare `goaltracker:`
 * come URL opaco.
 */
export function extractLoginTicket(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(LOGIN_DEEP_LINK_BASE)) return null;
  const match = /[?&]ticket=([a-f0-9]{64})(?:&|$)/.exec(url);
  return match ? match[1] : null;
}
