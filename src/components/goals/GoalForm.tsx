"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; color: string };
type Props = { categories: Category[]; initialData?: { id?: string; title: string; description: string; priority: string; targetDate: string; categoryId: string; tags: string[]; milestones: string[] } };

export default function GoalForm({ categories, initialData }: Props) {
  const router = useRouter();
  const isEditing = !!initialData?.id;
  const [form, setForm] = useState({ title: initialData?.title || "", description: initialData?.description || "", priority: initialData?.priority || "medium", targetDate: initialData?.targetDate || "", categoryId: initialData?.categoryId || "" });
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [milestones, setMilestones] = useState<string[]>(initialData?.milestones || []);
  const [milestoneInput, setMilestoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addTag() { const t = tagInput.trim().toLowerCase(); if (t && !tags.includes(t)) setTags([...tags, t]); setTagInput(""); }
  function addMilestone() { const m = milestoneInput.trim(); if (m) setMilestones([...milestones, m]); setMilestoneInput(""); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const url = isEditing ? `/api/goals/${initialData!.id}` : "/api/goals";
    const method = isEditing ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, tags, milestones }) });
    if (!res.ok) { const data = await res.json(); setError(data.error || "Errore"); setLoading(false); }
    else { const goal = await res.json(); router.push(`/goals/${goal.id}`); }
  }

  const inp = "w-full px-4 py-3 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 text-[#ede9ff] placeholder-[#4a3a7a]";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-950/50 text-red-400 text-sm rounded-xl px-4 py-3 border border-red-800/50">{error}</div>}
      <div><label className="block text-sm font-medium text-[#c4b5fd] mb-1">Titolo *</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Cosa vuoi raggiungere?" className={inp} /></div>
      <div><label className="block text-sm font-medium text-[#c4b5fd] mb-1">Descrizione</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrivi la tua missione..." className={`${inp} resize-none`} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-sm font-medium text-[#c4b5fd] mb-1">Difficoltà</label>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={inp}>
            <option value="low">🍃 Bassa</option><option value="medium">⚡ Media</option><option value="high">🔥 Alta</option>
          </select>
        </div>
        <div><label className="block text-sm font-medium text-[#c4b5fd] mb-1">🌙 Scadenza</label><input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} className={inp} /></div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#c4b5fd] mb-2">Categoria</label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setForm({ ...form, categoryId: "" })} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
            form.categoryId === "" ? "bg-[#ede9ff] text-[#0c0a1a] border-[#ede9ff]" : "bg-[#16112e] border-[#3b2d6e] text-[#9d8ac7]"
          }`}>Nessuna</button>
          {categories.map((c) => (
            <button key={c.id} type="button" onClick={() => setForm({ ...form, categoryId: c.id })} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              form.categoryId === c.id ? "text-black" : "bg-[#16112e] text-[#9d8ac7]"
            }`} style={form.categoryId === c.id ? { backgroundColor: c.color, borderColor: c.color } : { borderColor: "#3b2d6e" }}>{c.name}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[#c4b5fd] mb-1">Tag</label>
        <div className="flex gap-2 mb-2">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Aggiungi tag..." className="flex-1 px-4 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-[#ede9ff] placeholder-[#4a3a7a] text-sm" />
          <button type="button" onClick={addTag} className="px-4 py-2.5 bg-[#1e1740] text-[#c4b5fd] rounded-xl text-sm font-medium border border-[#3b2d6e]">+</button>
        </div>
        {tags.length > 0 && <div className="flex flex-wrap gap-2">{tags.map((t) => (<span key={t} className="flex items-center gap-1 text-xs bg-[#1e1740] text-[#9d8ac7] px-3 py-1 rounded-full border border-[#3b2d6e]">#{t}<button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-0.5 text-[#6b5a9e] hover:text-red-400">×</button></span>))}</div>}
      </div>
      {!isEditing && (
        <div>
          <label className="block text-sm font-medium text-[#c4b5fd] mb-1">⭐ Tappe / Sotto-obiettivi</label>
          <div className="flex gap-2 mb-2">
            <input value={milestoneInput} onChange={(e) => setMilestoneInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMilestone(); } }} placeholder="Aggiungi una tappa..." className="flex-1 px-4 py-2.5 rounded-xl bg-[#0f0d22] border border-[#3b2d6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-[#ede9ff] placeholder-[#4a3a7a] text-sm" />
            <button type="button" onClick={addMilestone} className="px-4 py-2.5 bg-[#1e1740] text-[#c4b5fd] rounded-xl text-sm font-medium border border-[#3b2d6e]">+</button>
          </div>
          {milestones.length > 0 && <div className="space-y-2">{milestones.map((m, i) => (<div key={i} className="flex items-center justify-between bg-[#0f0d22] border border-[#2a1f50] rounded-xl px-4 py-2.5 text-sm text-[#ede9ff]"><span className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-amber-900/40 text-amber-400 text-xs flex items-center justify-center font-semibold border border-amber-700/40">{i + 1}</span>{m}</span><button type="button" onClick={() => setMilestones(milestones.filter((_, j) => j !== i))} className="text-[#6b5a9e] hover:text-red-400">×</button></div>))}</div>}
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="flex-1 py-3 border border-[#3b2d6e] text-[#9d8ac7] rounded-xl font-semibold hover:bg-[#1e1740] transition-colors">Annulla</button>
        <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black rounded-xl font-bold disabled:opacity-60 shadow-lg shadow-amber-900/30">
          {loading ? "..." : isEditing ? "✨ Salva" : "⚔️ Crea missione"}
        </button>
      </div>
    </form>
  );
}
