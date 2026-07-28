import type { Metadata, Viewport } from "next";
import "./globals.css";

// Niente `manifest` né `appleWebApp`: l'app si distribuisce solo come APK
// (Capacitor), il browser non deve più proporre "Installa app". Il sito resta
// online perché è il backend che il guscio Android carica.
export const metadata: Metadata = {
  title: "Goal Tracker",
  description: "Traccia i tuoi obiettivi e ottieni ricompense",
  icons: {
    icon: "/icon-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b2d6e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
