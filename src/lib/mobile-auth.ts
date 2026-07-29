// Lato server dei ticket di accesso monouso (vedi login-ticket.ts per il
// disegno complessivo). Qui vivono conio e consumo, cioè tutto ciò che tocca
// crypto e database.

import { createHash, randomBytes } from "crypto";
import { prisma } from "./db";
import { initLoginTicketTable } from "./init-tables";
import { isValidTicketFormat, TICKET_TTL_MS } from "./login-ticket";

/**
 * In tabella finisce solo l'hash: un dump del DB non deve contenere ticket
 * spendibili, per quanto breve sia la loro vita.
 */
function hashTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("hex");
}

/**
 * Conia un ticket per l'utente e restituisce il valore in chiaro, che viaggia
 * solo dentro il deep link. Approfitta del passaggio per spazzare i ticket
 * scaduti: sono pochissimi (uno per login dall'APK) e così la tabella non ha
 * bisogno di un cron.
 */
export async function issueLoginTicket(userId: string): Promise<string> {
  await initLoginTicketTable();

  const ticket = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS);

  await prisma.$executeRawUnsafe(`DELETE FROM "LoginTicket" WHERE "expiresAt" < NOW()`);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "LoginTicket" ("tokenHash", "userId", "expiresAt") VALUES ($1, $2, $3)`,
    hashTicket(ticket),
    userId,
    expiresAt
  );

  return ticket;
}

/**
 * Consuma un ticket e restituisce l'utente a cui apparteneva, o null se il
 * ticket non esiste, è scaduto o è già stato speso.
 *
 * DELETE … RETURNING rende il consumo atomico: due tentativi con lo stesso
 * ticket non possono riuscire entrambi, chi arriva secondo trova la riga
 * già sparita. È ciò che rende "monouso" una garanzia e non una speranza.
 */
export async function consumeLoginTicket(ticket: string): Promise<string | null> {
  if (!isValidTicketFormat(ticket)) return null;
  await initLoginTicketTable();

  const rows = await prisma.$queryRawUnsafe<{ userId: string }[]>(
    `DELETE FROM "LoginTicket" WHERE "tokenHash" = $1 AND "expiresAt" > NOW() RETURNING "userId"`,
    hashTicket(ticket)
  );

  return rows[0]?.userId ?? null;
}
