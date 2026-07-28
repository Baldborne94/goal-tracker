"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { isNativePlatform, nativeGoogleIdToken } from "@/lib/capacitor-auth";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading(true);
    setError(null);

    // Dentro l'APK il flusso OAuth web è vietato da Google
    // (disallowed_useragent): si passa dal Sign-In nativo. Niente fallback
    // web sul nativo — fallirebbe comunque, meglio un errore chiaro.
    if (await isNativePlatform()) {
      const idToken = await nativeGoogleIdToken();
      if (!idToken) {
        setError("Accesso annullato o non riuscito. Riprova.");
        setLoading(false);
        return;
      }
      const res = await signIn("google-native", { idToken, redirect: false });
      if (res?.ok) {
        window.location.href = "/dashboard";
        return;
      }
      setError("Il server ha rifiutato l'accesso. Riprova tra qualche istante.");
      setLoading(false);
      return;
    }

    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#07051a]">
      {/* Layered cosmic background */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% -10%, #4c1d9533 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, #1e1b4b22 0%, transparent 45%), radial-gradient(ellipse at 15% 85%, #0c4a6e18 0%, transparent 45%)"
      }} />

      {/* Stars */}
      {Array.from({ length: 70 }).map((_, i) => {
        const size = i % 7 === 0 ? "2px" : "1px";
        const top = `${(i * 137.5) % 100}%`;
        const left = `${(i * 97.3) % 100}%`;
        const delay = `${(i * 0.17) % 5}s`;
        const dur = `${2.5 + (i % 4)}s`;
        return (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ width: size, height: size, top, left, animationDelay: delay, animationDuration: dur, animation: `twinkle ${dur} ease-in-out ${delay} infinite` }}
          />
        );
      })}

      {/* Purple glow blob */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-20 blur-3xl pointer-events-none" style={{ background: "radial-gradient(ellipse, #7c3aed, transparent 70%)" }} />
      {/* Amber glow blob */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] opacity-15 blur-3xl pointer-events-none" style={{ background: "radial-gradient(ellipse, #f59e0b, transparent 70%)" }} />

      {/* Content card */}
      <div className="relative z-10 flex flex-col items-center px-8 w-full max-w-[360px]">

        {/* Sword with glow */}
        <div className="relative mb-5">
          <div className="absolute inset-0 scale-[2] blur-2xl opacity-50" style={{ background: "radial-gradient(circle, #f59e0b66, transparent 70%)" }} />
          <div className="relative text-[80px] leading-none select-none" style={{ filter: "drop-shadow(0 0 30px #f59e0baa) drop-shadow(0 0 60px #7c3aed55)" }}>
            ⚔️
          </div>
        </div>

        {/* Title */}
        <h1 className="text-[42px] font-black tracking-tight leading-none mb-2 text-center" style={{
          background: "linear-gradient(150deg, #fde68a 0%, #f59e0b 35%, #c4b5fd 80%, #ede9ff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}>
          Goal Tracker
        </h1>
        <p className="text-[11px] tracking-[0.25em] uppercase font-semibold mb-10" style={{ color: "#6d5fa6" }}>
          ✦ Enter your realm ✦
        </p>

        {/* Card */}
        <div className="w-full rounded-3xl p-[1px]" style={{
          background: "linear-gradient(135deg, #f59e0b55, #7c3aed44, #06b6d455)"
        }}>
          <div className="w-full rounded-3xl p-6" style={{ background: "rgba(10, 7, 30, 0.92)", backdropFilter: "blur(24px)" }}>

            {/* Google button */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full relative overflow-hidden rounded-2xl font-bold text-[15px] transition-all duration-200 active:scale-[0.97] disabled:opacity-60"
              style={{ padding: "1px", background: loading ? "#3b2d6e" : "linear-gradient(135deg, #f59e0b, #a855f7, #06b6d4)" }}
            >
              <div className="flex items-center justify-center gap-3 w-full rounded-2xl py-[14px] px-5" style={{ background: loading ? "transparent" : "#0f0b24" }}>
                {!loading && (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span style={{
                  background: loading ? "#9d8ac7" : "linear-gradient(90deg, #fde68a, #e2d9f3)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}>
                  {loading ? "Entering the realm..." : "Continue with Google"}
                </span>
              </div>
            </button>

            {error && (
              <p className="text-center text-[12px] mt-4" style={{ color: "#fca5a5" }}>
                {error}
              </p>
            )}

            <p className="text-center text-[11px] mt-4" style={{ color: "#3b2d6e" }}>
              Your quest awaits, hero.
            </p>
          </div>
        </div>

        {/* Decorative bottom runes */}
        <div className="flex items-center gap-2 mt-8 opacity-25">
          {["✦", "⚔", "✦", "⚔", "✦"].map((r, i) => (
            <span key={i} className="text-[10px]" style={{ color: "#7c3aed" }}>{r}</span>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.08; transform: scale(1); }
          50% { opacity: 0.75; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
