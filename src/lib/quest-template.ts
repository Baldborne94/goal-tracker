// Condivisione di una missione come modello, via link.
//
// Il contratto vive qui perché lo usano due lati diversi: il client che
// costruisce il link e la pagina server che lo apre.
//
// Perché non basta `btoa`: quella funzione parla solo latino-1, quindi
// un'emoji nel titolo la fa proprio esplodere («Invalid character») e una
// lettera accentata produce byte che il server, leggendo in UTF-8, non
// riconosce. In più il base64 classico contiene `+` e `/`, e dentro un
// indirizzo il `+` viene riletto come spazio: il link arrivava corrotto.
//
// Rimedio: si codifica il testo in UTF-8 e si usa l'alfabeto base64url
// (`-` e `_` al posto di `+` e `/`, senza `=` finali), che negli indirizzi
// attraversa indenne.

export type QuestTemplate = {
  title: string;
  description: string;
  priority: string;
  milestones: string[];
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): Uint8Array {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodeQuestTemplate(template: QuestTemplate): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(template)));
}

/**
 * Restituisce null su qualunque anomalia — link troncato, modificato a mano,
 * di una versione vecchia: un modello mezzo letto sarebbe peggio di nessun
 * modello, e la pagina "nuova missione" deve aprirsi comunque.
 */
export function decodeQuestTemplate(encoded: string | null | undefined): QuestTemplate | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded)));
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.title !== "string" || !parsed.title.trim()) return null;

    return {
      title: String(parsed.title),
      description: typeof parsed.description === "string" ? parsed.description : "",
      priority: typeof parsed.priority === "string" ? parsed.priority : "medium",
      milestones: Array.isArray(parsed.milestones)
        ? parsed.milestones.filter((m: unknown): m is string => typeof m === "string")
        : [],
    };
  } catch {
    return null;
  }
}
