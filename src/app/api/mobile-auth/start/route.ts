import { NextResponse } from "next/server";
import { auth, signIn } from "@/lib/auth";

// GET /api/mobile-auth/start — primo passo del login Google dall'APK.
//
// Questa pagina viene aperta nel BROWSER DI SISTEMA dal guscio Android (mai
// nella WebView: lì Google rifiuta l'OAuth web con disallowed_useragent).
// Nel browser il flusso web di Google funziona come su desktop; alla fine
// l'utente atterra su /finish, che conia il ticket e rimanda all'app.
//
// Se il browser ha già una sessione del sito (l'utente è entrato dal browser
// in passato), Google non serve proprio: si salta dritti al ticket.
export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.id) {
    return NextResponse.redirect(new URL("/api/mobile-auth/finish", req.url));
  }

  // signIn server-side risponde con il redirect verso Google; il ritorno è
  // /finish perché il browser deve arrivarci comunque, anche se l'utente nel
  // frattempo cambia account o annulla e riprova.
  await signIn("google", { redirectTo: "/api/mobile-auth/finish" });
}
