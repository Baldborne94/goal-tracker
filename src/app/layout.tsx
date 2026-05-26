import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goal Tracker",
  description: "Traccia i tuoi obiettivi e ottieni ricompense",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Goal Tracker",
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
