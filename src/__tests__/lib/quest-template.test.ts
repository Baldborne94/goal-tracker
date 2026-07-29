import { describe, it, expect } from "vitest";
import { decodeQuestTemplate, encodeQuestTemplate, type QuestTemplate } from "@/lib/quest-template";

const base: QuestTemplate = {
  title: "Corri 10km",
  description: "Preparazione alla mezza maratona",
  priority: "high",
  milestones: ["Settimana 1", "Settimana 2"],
};

// Il link passa dentro un indirizzo: il modo più onesto di provarlo è farcelo
// passare davvero, invece di fidarsi della stringa nuda.
function roundTrip(t: QuestTemplate) {
  const url = new URL(`https://app.dev/goals/new?template=${encodeQuestTemplate(t)}`);
  return decodeQuestTemplate(url.searchParams.get("template"));
}

describe("il link del modello sopravvive al viaggio", () => {
  it("caso semplice", () => {
    expect(roundTrip(base)).toEqual(base);
  });

  it("emoji nel titolo — prima btoa lanciava «Invalid character»", () => {
    const t = { ...base, title: "Corri 10km 🏃‍♂️💨", milestones: ["Tappa 1 🏅"] };
    expect(roundTrip(t)).toEqual(t);
  });

  it("accenti — prima il + del base64 diventava spazio e rompeva tutto", () => {
    const t = { ...base, title: "Corri più veloce", description: "Perché sì, però con calma" };
    expect(roundTrip(t)).toEqual(t);
  });

  it("il codice non contiene caratteri che gli indirizzi maltrattano", () => {
    const encoded = encodeQuestTemplate({ ...base, title: "Più forza 💪 ogni giorno" });
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("cinese, cirillico e simboli", () => {
    const t = { ...base, title: "健康 · Здоровье · ½ + ¾", milestones: ["→ inizio", "✓ fine"] };
    expect(roundTrip(t)).toEqual(t);
  });
});

describe("decodeQuestTemplate — robustezza", () => {
  it("null su spazzatura, invece di far esplodere la pagina", () => {
    expect(decodeQuestTemplate("non-e-base64!!!")).toBeNull();
    expect(decodeQuestTemplate("")).toBeNull();
    expect(decodeQuestTemplate(null)).toBeNull();
    expect(decodeQuestTemplate(undefined)).toBeNull();
  });

  it("null su un link troncato a metà", () => {
    const full = encodeQuestTemplate(base);
    expect(decodeQuestTemplate(full.slice(0, Math.floor(full.length / 2)))).toBeNull();
  });

  it("null se manca il titolo: un modello senza nome non è un modello", () => {
    const encoded = encodeQuestTemplate({ ...base, title: "   " });
    expect(decodeQuestTemplate(encoded)).toBeNull();
  });

  it("legge ancora i vecchi link in base64 classico, se erano solo ASCII", () => {
    const legacy = Buffer.from(JSON.stringify(base), "utf-8").toString("base64");
    expect(decodeQuestTemplate(legacy)).toEqual(base);
  });

  it("normalizza i campi mancanti invece di propagare undefined", () => {
    const encoded = Buffer.from(JSON.stringify({ title: "Solo il titolo" }), "utf-8").toString("base64url");
    expect(decodeQuestTemplate(encoded)).toEqual({
      title: "Solo il titolo",
      description: "",
      priority: "medium",
      milestones: [],
    });
  });

  it("scarta le tappe che non sono testo", () => {
    const encoded = Buffer.from(
      JSON.stringify({ title: "X", milestones: ["ok", 42, null, { a: 1 }] }),
      "utf-8"
    ).toString("base64url");
    expect(decodeQuestTemplate(encoded)?.milestones).toEqual(["ok"]);
  });
});
