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
  // ── Warriors ─────────────────────────────────────────────
  {
    key: "fighter", name: "Fighter", icon: "⚔️",
    description: "Master of weapons and combat tactics",
    theme: "warrior", group: "warrior",
    tiers: mk(
      ["Recruit", "Soldier", "Squire", "Knight", "Champion", "Commander", "Warlord", "Legendary Hero"],
      ["🗡️", "⚔️", "🛡️", "🏆", "🏰", "⚜️", "🔱", "✨"]
    ),
  },
  {
    key: "paladin", name: "Paladin", icon: "🛡️",
    description: "Holy warrior bound by a sacred oath",
    theme: "warrior", group: "warrior",
    tiers: mk(
      ["Initiate", "Aspirant", "Templar", "Paladin", "Holy Knight", "Sacred Guard", "Divine Champion", "Avatar of Light"],
      ["🕯️", "✝️", "🛡️", "⚔️", "🌟", "👼", "☀️", "✨"]
    ),
  },
  {
    key: "barbarian", name: "Barbarian", icon: "🪓",
    description: "Primal warrior fueled by unstoppable rage",
    theme: "warrior", group: "warrior",
    tiers: mk(
      ["Savage", "Berserker", "Ravager", "Slayer", "Chieftain", "Warchief", "Battle God", "Primal Force"],
      ["🪓", "💢", "⚔️", "🔪", "🐺", "🦁", "🔥", "🌪️"]
    ),
  },
  // ── Nature ───────────────────────────────────────────────
  {
    key: "ranger", name: "Ranger", icon: "🏹",
    description: "Hunter and explorer of the untamed wild",
    theme: "forest", group: "nature",
    tiers: mk(
      ["Scout", "Hunter", "Tracker", "Ranger", "Strider", "Pathfinder", "Shadow Walker", "Legend of the Wild"],
      ["👁️", "🏹", "🐾", "🌲", "🧭", "🌙", "🌿", "✨"]
    ),
  },
  {
    key: "druid", name: "Druid", icon: "🌿",
    description: "Shapeshifter attuned to the forces of nature",
    theme: "forest", group: "nature",
    tiers: mk(
      ["Seedling", "Grove Ward", "Shaman", "Druid", "Elder Druid", "Circle Master", "Voice of Nature", "World Tree"],
      ["🌱", "🍃", "🌿", "🌳", "🌲", "🌙", "🌍", "✨"]
    ),
  },
  // ── Arcane ───────────────────────────────────────────────
  {
    key: "rogue", name: "Rogue", icon: "🗡️",
    description: "Shadow operative and master of stealth",
    theme: "crimson", group: "arcane",
    tiers: mk(
      ["Street Rat", "Cutpurse", "Infiltrator", "Assassin", "Shadow", "Phantom", "Wraith", "Ghost"],
      ["🐀", "🎭", "🕵️", "🗡️", "🌑", "👻", "💀", "✨"]
    ),
  },
  {
    key: "wizard", name: "Wizard", icon: "🧙",
    description: "Scholar who masters the arcane arts",
    theme: "crimson", group: "arcane",
    tiers: mk(
      ["Apprentice", "Conjurer", "Invoker", "Mage", "Archmage", "High Wizard", "Grand Magister", "Omniscient"],
      ["📖", "✋", "🔮", "🧙", "📜", "🌟", "🔱", "✨"]
    ),
  },
  {
    key: "sorcerer", name: "Sorcerer", icon: "✨",
    description: "Born with raw untamed magical power",
    theme: "crimson", group: "arcane",
    tiers: mk(
      ["Touched", "Spark", "Flare", "Sorcerer", "Wild Mage", "Arcane Soul", "Chaos Lord", "Primordial Force"],
      ["💫", "⚡", "🔥", "✨", "🌀", "💎", "🌪️", "🌌"]
    ),
  },
  {
    key: "necromancer", name: "Necromancer", icon: "💀",
    description: "Master of death, undeath and dark power",
    theme: "crimson", group: "arcane",
    tiers: mk(
      ["Bone Collector", "Grave Caller", "Corpse Keeper", "Necromancer", "Death Mage", "Soul Reaper", "Lich", "Dark Sovereign"],
      ["🦴", "💀", "⚰️", "🕯️", "💀", "⚰️", "👑", "🌑"]
    ),
  },
  // ── Holy ─────────────────────────────────────────────────
  {
    key: "cleric", name: "Cleric", icon: "✝️",
    description: "Divine spellcaster and healer of the gods",
    theme: "ocean", group: "holy",
    tiers: mk(
      ["Acolyte", "Deacon", "Priest", "Cleric", "High Priest", "Oracle", "Divine Vessel", "Saint"],
      ["🕯️", "✝️", "🙏", "✝️", "👼", "🌟", "☀️", "✨"]
    ),
  },
  {
    key: "bard", name: "Bard", icon: "🎵",
    description: "Performer who weaves magic through art",
    theme: "ocean", group: "holy",
    tiers: mk(
      ["Minstrel", "Troubadour", "Skald", "Bard", "Lorekeeper", "Voice of Ages", "Grand Storyteller", "Living Legend"],
      ["🎵", "🎶", "🎸", "🎭", "📚", "🎼", "🌟", "✨"]
    ),
  },
  {
    key: "monk", name: "Monk", icon: "🥋",
    description: "Master of body, mind and ki energy",
    theme: "ocean", group: "holy",
    tiers: mk(
      ["Novice", "Initiate", "Adept", "Disciple", "Sensei", "Grand Master", "Enlightened", "Transcendent"],
      ["🙏", "🥋", "💨", "☯️", "🌸", "🌟", "🌙", "✨"]
    ),
  },
];

export function getClassDef(key: HeroClass | string | null | undefined): ClassDef {
  return CLASSES.find((c) => c.key === key) ?? CLASSES[0];
}

export const CLASS_GROUPS: { key: ClassDef["group"]; label: string; color: string }[] = [
  { key: "warrior", label: "⚔️ Warriors",  color: "#f59e0b" },
  { key: "nature",  label: "🌿 Nature",    color: "#22c55e" },
  { key: "arcane",  label: "🔮 Arcane",    color: "#e879f9" },
  { key: "holy",    label: "✝️ Holy",      color: "#38bdf8" },
];
