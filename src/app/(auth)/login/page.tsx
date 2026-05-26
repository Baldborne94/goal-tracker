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
      setError("Email o password errati");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0a1a] p-4" style={{backgroundImage: "radial-gradient(ellipse at 50% 0%, #2d1b6e22 0%, transparent 70%)"}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🔮</div>
          <h1 className="text-2xl font-bold text-[#ede9ff]">Goal Tracker</h1>
          <p className="text-[#9d8ac7] text-sm mt-1">Accedi al tuo regno</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#16112e] rounded-2xl border border-[#3b2d6e] p-6 space-y-4 shadow-xl shadow-purple-950/50">
          {error && (
            <div className="bg-red-950/50 text-red-400 text-sm rounded-xl px-4 py-3 border border-red-800/50">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#c4b5fd] mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 text-[#ede9ff] placeholder-[#4a3a7a]"
              placeholder="tu@email.com"
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
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl font-bold hover:from-amber-400 hover:to-yellow-300 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-amber-900/30"
          >
            {loading ? "Accesso in corso..." : "⚔️ Entra nel regno"}
          </button>
        </form>

        <p className="text-center text-sm text-[#6b5a9e] mt-4">
          Non hai un account?{" "}
          <Link href="/register" className="text-amber-400 font-medium hover:text-amber-300">
            Inizia l&apos;avventura
          </Link>
        </p>
      </div>
    </div>
  );
}
