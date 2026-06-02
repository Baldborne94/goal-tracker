"use client";

import { createContext, useContext, useState } from "react";

export const THEMES = {
  warrior: {
    key: "warrior",
    name: "⚔️ Warrior",
    accent: "#f59e0b",
    gradient: "linear-gradient(135deg, #2d1b6e 0%, #1a0f3e 50%, #0f0826 100%)",
    border: "#4c3880",
    bar: "linear-gradient(90deg, #f59e0b, #fbbf24)",
    glow: "#f59e0b33",
    bg: "#07051a",
    surface: "#16112e",
    surfaceBorder: "#3b2d6e",
    textMuted: "#9d8ac7",
  },
  ocean: {
    key: "ocean",
    name: "🌊 Ocean",
    accent: "#22d3ee",
    gradient: "linear-gradient(135deg, #0c2a52 0%, #071a36 50%, #030d1e 100%)",
    border: "#1e4a7a",
    bar: "linear-gradient(90deg, #22d3ee, #67e8f9)",
    glow: "#22d3ee33",
    bg: "#020c1b",
    surface: "#071a36",
    surfaceBorder: "#1e4a7a",
    textMuted: "#7ab8d9",
  },
  forest: {
    key: "forest",
    name: "🌿 Forest",
    accent: "#34d399",
    gradient: "linear-gradient(135deg, #0d3b2d 0%, #072b1f 50%, #031510 100%)",
    border: "#1e5c3e",
    bar: "linear-gradient(90deg, #34d399, #6ee7b7)",
    glow: "#34d39933",
    bg: "#020e09",
    surface: "#0a2218",
    surfaceBorder: "#1e5c3e",
    textMuted: "#6bb88a",
  },
  crimson: {
    key: "crimson",
    name: "🌹 Crimson",
    accent: "#fb7185",
    gradient: "linear-gradient(135deg, #3b0d2a 0%, #270919 50%, #120308 100%)",
    border: "#6b1a3a",
    bar: "linear-gradient(90deg, #fb7185, #fda4af)",
    glow: "#fb718533",
    bg: "#0d0208",
    surface: "#1e0510",
    surfaceBorder: "#6b1a3a",
    textMuted: "#b06a80",
  },
} as const;

export type ThemeKey = keyof typeof THEMES;

const ThemeContext = createContext<{
  theme: ThemeKey;
  colors: (typeof THEMES)[ThemeKey];
  setTheme: (t: ThemeKey) => void;
}>({
  theme: "warrior",
  colors: THEMES.warrior,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children, initialTheme }: { children: React.ReactNode; initialTheme?: ThemeKey }) {
  const [theme, setThemeState] = useState<ThemeKey>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hero-theme") as ThemeKey;
      if (stored && stored in THEMES) return stored;
    }
    return initialTheme ?? "warrior";
  });

  function setTheme(t: ThemeKey) {
    setThemeState(t);
    localStorage.setItem("hero-theme", t);
  }

  const colors = THEMES[theme];

  return (
    <ThemeContext.Provider value={{ theme, colors, setTheme }}>
      <div
        suppressHydrationWarning
        style={
          {
            "--theme-gradient": colors.gradient,
            "--theme-border": colors.border,
            "--theme-accent": colors.accent,
            "--theme-bar": colors.bar,
            "--theme-glow": colors.glow,
            "--theme-bg": colors.bg,
            "--theme-surface": colors.surface,
            "--theme-surface-border": colors.surfaceBorder,
            "--theme-text-muted": colors.textMuted,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
