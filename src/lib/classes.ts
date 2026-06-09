import type { ThemeKey } from "@/components/ThemeProvider";

export type HeroClass =
  | "fighter" | "paladin" | "barbarian"
  | "ranger" | "druid"
  | "rogue" | "wizard" | "sorcerer" | "necromancer"
  | "cleric" | "bard" | "monk";

export interface ClassTier {
  label: string;
  icon: string;
  min: number;
  max: number;
}

export interface ClassDef {
  key: HeroClass;
  name: string;
  icon: string;
  description: string;
  theme: ThemeKey;
  group: "warrior" | "nature" | "arcane" | "holy";
  tiers: ClassTier[];
}

const T = [0, 200, 600, 1500, 3000, 6000, 10000, 20000];
const M = [199, 599, 1499, 2999, 5999, 9999, 19999, Infinity];

function mk(labels: string[], icons: string[]): ClassTier[] {
  return labels.map((label, i) => ({ label, icon: icons[i], min: T[i], max: M[i] }));
}

export const CLASSES: ClassDef[] = [
  // ── Guerrieri ─────────────────────────────────────────────
  {
    key: "fighter", name: "Guerriero", icon: "⚔️",
    description: "Maestro delle armi e delle tattiche di combattimento",
    theme: "warrior", group: "warrior",
    tiers: mk(
      ["Recluta", "Soldato", "Scudiero", "Cavaliere", "Campione", "Comandante", "Condottiero", "Eroe Leggendario"],
      ["🗡️", "⚔️", "🛡️", "🏆", "🏰", "⚜️", "🔱", "✨"]
    ),
  },
  {
    key: "paladin", name: "Paladino", icon: "🛡️",
    description: "Guerriero sacro legato da un giuramento divino",
    theme: "warrior", group: "warrior",
    tiers: mk(
      ["Novizio", "Aspirante", "Templare", "Crociato", "Cavaliere Santo", "Guardia Sacra", "Campione Divino", "Avatara della Luce"],
      ["🕯️", "✝️", "🛡️", "⚔️", "🌟", "👼", "☀️", "✨"]
    ),
  },
  {
    key: "barbarian", name: "Barbaro", icon: "🪓",
    description: "Guerriero primordiale alimentato da furia inarrestabile",
    theme: "warrior", group: "warrior",
    tiers: mk(
      ["Selvaggio", "Berserker", "Devastatore", "Massacratore", "Capo", "Gran Capo", "Dio della Battaglia", "Forza Primordiale"],
      ["🪓", "💢", "⚔️", "🔪", "🐺", "🦁", "🔥", "🌪️"]
    ),
  },
  // ── Natura ───────────────────────────────────────────────
  {
    key: "ranger", name: "Ranger", icon: "🏹",
    description: "Cacciatore ed esploratore della natura selvaggia",
    theme: "forest", group: "nature",
    tiers: mk(
      ["Esploratore", "Cacciatore", "Segugio", "Guardiano", "Vagabondo", "Pioniere", "Camminatore delle Ombre", "Leggenda della Natura"],
      ["👁️", "🏹", "🐾", "🌲", "🧭", "🌙", "🌿", "✨"]
    ),
  },
  {
    key: "druid", name: "Druido", icon: "🌿",
    description: "Mutaforma in sintonia con le forze della natura",
    theme: "forest", group: "nature",
    tiers: mk(
      ["Germoglio", "Custode del Bosco", "Sciamano", "Mutaforma", "Anziano della Foresta", "Maestro del Cerchio", "Voce della Natura", "Albero del Mondo"],
      ["🌱", "🍃", "🌿", "🌳", "🦋", "🌙", "🌍", "✨"]
    ),
  },
  // ── Arcano ───────────────────────────────────────────────
  {
    key: "rogue", name: "Ladro", icon: "🗡️",
    description: "Agente nell'ombra e maestro della furtività",
    theme: "crimson", group: "arcane",
    tiers: mk(
      ["Topo di Strada", "Borseggiatore", "Infiltrato", "Assassino", "Ombra", "Fantasma", "Spettro", "Spirito"],
      ["🐀", "🎭", "🕵️", "🗡️", "🌑", "👻", "💀", "✨"]
    ),
  },
  {
    key: "wizard", name: "Mago", icon: "🧙",
    description: "Studioso che padroneggia le arti arcane",
    theme: "crimson", group: "arcane",
    tiers: mk(
      ["Apprendista", "Evocatore", "Invocatore", "Incantatore", "Arcimago", "Alto Mago", "Gran Magistro", "Onnisciente"],
      ["📖", "✋", "🔮", "🧙", "📜", "🌟", "🔱", "✨"]
    ),
  },
  {
    key: "sorcerer", name: "Stregone", icon: "✨",
    description: "Nato con un grezzo potere magico indomabile",
    theme: "crimson", group: "arcane",
    tiers: mk(
      ["Toccato", "Scintilla", "Bagliore", "Canale", "Mago Selvaggio", "Anima Arcana", "Signore del Caos", "Forza Primordiale"],
      ["💫", "⚡", "🔥", "🌟", "🌀", "💎", "🌪️", "🌌"]
    ),
  },
  {
    key: "necromancer", name: "Negromante", icon: "💀",
    description: "Maestro della morte, dei non-morti e del potere oscuro",
    theme: "crimson", group: "arcane",
    tiers: mk(
      ["Raccoglitore di Ossa", "Evocatore di Tombe", "Custode di Cadaveri", "Signore del Terrore", "Mago della Morte", "Mietitore di Anime", "Lich", "Sovrano delle Tenebre"],
      ["🦴", "💀", "⚰️", "🕯️", "🌑", "🪦", "👑", "☠️"]
    ),
  },
  // ── Sacro ─────────────────────────────────────────────────
  {
    key: "cleric", name: "Chierico", icon: "✝️",
    description: "Incantatore divino e guaritore degli dei",
    theme: "ocean", group: "holy",
    tiers: mk(
      ["Accolito", "Diacono", "Sacerdote", "Confessore", "Gran Sacerdote", "Oracolo", "Vaso Divino", "Santo"],
      ["🕯️", "✝️", "🙏", "📿", "👼", "🌟", "☀️", "✨"]
    ),
  },
  {
    key: "bard", name: "Bardo", icon: "🎵",
    description: "Esecutore che tesse la magia attraverso l'arte",
    theme: "ocean", group: "holy",
    tiers: mk(
      ["Menestrello", "Trovatore", "Skald", "Virtuoso", "Guardiano della Tradizione", "Voce dei Secoli", "Gran Narratore", "Leggenda Vivente"],
      ["🎵", "🎶", "🎸", "🎭", "📚", "🎼", "🌟", "✨"]
    ),
  },
  {
    key: "monk", name: "Monaco", icon: "🥋",
    description: "Maestro del corpo, della mente e dell'energia ki",
    theme: "ocean", group: "holy",
    tiers: mk(
      ["Novizio", "Iniziato", "Adepto", "Discepolo", "Sensei", "Gran Maestro", "Illuminato", "Trascendente"],
      ["🙏", "🥋", "💨", "☯️", "🌸", "🌟", "🌙", "✨"]
    ),
  },
];

export function getClassDef(key: HeroClass | string | null | undefined): ClassDef {
  return CLASSES.find((c) => c.key === key) ?? CLASSES[0];
}

export const CLASS_GROUPS: { key: ClassDef["group"]; label: string; color: string }[] = [
  { key: "warrior", label: "⚔️ Guerrieri", color: "#f59e0b" },
  { key: "nature",  label: "🌿 Natura",    color: "#22c55e" },
  { key: "arcane",  label: "🔮 Arcano",    color: "#e879f9" },
  { key: "holy",    label: "✝️ Sacro",     color: "#38bdf8" },
];
