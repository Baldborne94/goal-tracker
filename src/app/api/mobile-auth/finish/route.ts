import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { issueLoginTicket } from "@/lib/mobile-auth";
import { buildLoginDeepLink, TICKET_TTL_MS } from "@/lib/login-ticket";

// GET /api/mobile-auth/finish — ultimo passo del login Google dall'APK.
//
// A questo punto il browser di sistema ha una sessione valida (arriva da
// /start, direttamente o passando dall'OAuth di Google). Qui si conia il
// ticket monouso e si rimbalza sul deep link goaltracker://login?ticket=…
// che riporta dentro l'app.
//
// Il salto è una pagina HTML e non un redirect 302: Chrome blocca i redirect
// server-side verso schemi custom se non c'è un gesto dell'utente nella
// catena, e il blocco è silenzioso. La pagina tenta il salto da script e
// tiene un pulsante ben visibile come via garantita.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const ticket = await issueLoginTicket(session.user.id);
  const deepLink = buildLoginDeepLink(ticket);
  const minutes = Math.round(TICKET_TTL_MS / 60_000);

  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Torna all'app — Goal Tracker</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#07051a; color:#ede9ff; font-family:system-ui,sans-serif; text-align:center; }
  main { padding:2rem; max-width:22rem; }
  .sword { font-size:56px; }
  h1 { font-size:1.25rem; margin:.75rem 0 .25rem; }
  p { color:#9d8ac7; font-size:.85rem; line-height:1.5; margin:.5rem 0 1.5rem; }
  a.btn { display:block; padding:14px 20px; border-radius:16px; font-weight:700; text-decoration:none;
          color:#0b0b13; background:linear-gradient(135deg,#f59e0b,#a855f7); }
</style>
</head>
<body>
<main>
  <div class="sword">⚔️</div>
  <h1>Accesso riuscito</h1>
  <p>Ti riporto su Goal Tracker. Se non succede da solo, tocca il pulsante —
     il collegamento vale ${minutes} minuti e una volta sola.</p>
  <a class="btn" href="${deepLink}">Apri Goal Tracker</a>
</main>
<script>
  // Tentativo automatico: se Chrome lo blocca (serve un gesto), resta il
  // pulsante. Nessun replace: la pagina deve rimanere nella cronologia per
  // poter ritoccare il pulsante.
  setTimeout(function () { window.location.href = ${JSON.stringify(deepLink)}; }, 400);
</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Il ticket dentro la pagina è spendibile: niente cache, da nessuna parte.
      "Cache-Control": "no-store",
    },
  });
}
