"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0a1a] p-4" style={{backgroundImage: "radial-gradient(ellipse at 50% 0%, #2d1b6e22 0%, transparent 70%)"}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚔️</div>
          <h1 className="text-2xl font-bold text-[#ede9ff]">Goal Tracker</h1>
          <p className="text-[#9d8ac7] text-sm mt-1">Enter your realm</p>
        </div>

        <div className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-6 space-y-4 shadow-xl shadow-purple-950/50">
          {error && (
            <div className="bg-red-950/50 text-red-400 text-sm rounded-xl px-4 py-3 border border-red-800/50">
              {error}
            </div>
          )}

          {/* Google sign-in */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full py-3 flex items-center justify-center gap-3 bg-white text-gray-800 rounded-xl font-semibold hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-60 shadow-md"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {googleLoading ? "Signing in..." : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#3b2d6e]" />
            <span className="text-xs text-[#4a3a7a]">or</span>
            <div className="flex-1 h-px bg-[#3b2d6e]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#c4b5fd] mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 text-[#ede9ff] placeholder-[#4a3a7a]"
                placeholder="you@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#c4b5fd] mb-1">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 text-[#ede9ff] placeholder-[#4a3a7a]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl font-bold hover:from-amber-400 hover:to-yellow-300 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-amber-900/30"
            >
              {loading ? "Signing in..." : "⚔️ Enter the realm"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#6b5a9e] mt-4">
          No account yet?{" "}
          <Link href="/register" className="text-amber-400 font-medium hover:text-amber-300">
            Begin the adventure
          </Link>
        </p>
      </div>
    </div>
  );
}
