import type { CapacitorConfig } from "@capacitor/cli";

// L'app Android è un guscio WebView che carica la PWA già deployata su Vercel:
// un solo deploy da mantenere, e il codice Next.js resta invariato. Il guscio
// serve solo per il ponte nativo verso Health Connect, che una PWA nel browser
// non può usare.
//
// Override dell'URL per puntare a un preview o al dev server locale:
//   CAPACITOR_SERVER_URL=http://192.168.1.10:3000 npx cap sync android

const serverUrl = process.env.CAPACITOR_SERVER_URL ?? "https://goal-tracker-five-wheat.vercel.app";

const config: CapacitorConfig = {
  appId: "app.vercel.goaltracker",
  appName: "Goal Tracker",
  // Non usata a runtime (il contenuto arriva da server.url) ma richiesta dalla CLI.
  webDir: "public",
  server: {
    url: serverUrl,
    androidScheme: "https",
    // In locale il dev server è in chiaro: senza questo il WebView blocca http://
    cleartext: serverUrl.startsWith("http://"),
  },
  android: {
    // Le sessioni NextAuth restano valide fra riaperture dell'app.
    webContentsDebuggingEnabled: false,
  },
};

export default config;
