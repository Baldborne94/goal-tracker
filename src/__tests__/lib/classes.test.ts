import { describe, it, expect } from "vitest";
import { CLASSES, getClassDef, CLASS_GROUPS } from "@/lib/classes";

describe("CLASSES — integrity", () => {
  it("has exactly 12 classes", () => {
    expect(CLASSES).toHaveLength(12);
  });

  it("every class has exactly 8 tiers", () => {
    for (const cls of CLASSES) {
      expect(cls.tiers, `${cls.name} should have 8 tiers`).toHaveLength(8);
    }
  });

  it("all required fields are present on every class", () => {
    for (const cls of CLASSES) {
      expect(cls.key).toBeTruthy();
      expect(cls.name).toBeTruthy();
      expect(cls.icon).toBeTruthy();
      expect(cls.description).toBeTruthy();
      expect(cls.theme).toBeTruthy();
      expect(["warrior", "nature", "arcane", "holy"]).toContain(cls.group);
    }
  });

  it("no duplicate class keys", () => {
    const keys = CLASSES.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("tier min/max boundaries are non-overlapping and ascending", () => {
    for (const cls of CLASSES) {
      for (let i = 0; i < cls.tiers.length - 1; i++) {
        const current = cls.tiers[i];
        const next = cls.tiers[i + 1];
        expect(current.max + 1, `${cls.name} tier ${i + 1} max+1 should equal tier ${i + 2} min`)
          .toBe(next.min);
      }
    }
  });

  it("no duplicate tier icons within any class", () => {
    for (const cls of CLASSES) {
      const icons = cls.tiers.map(t => t.icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size, `${cls.name} has duplicate tier icons: ${icons.join(", ")}`).toBe(icons.length);
    }
  });

  it("class name never appears as a tier label", () => {
    for (const cls of CLASSES) {
      for (const tier of cls.tiers) {
        expect(tier.label, `${cls.name} tier '${tier.label}' should not equal class name`).not.toBe(cls.name);
      }
    }
  });
});

describe("getClassDef", () => {
  it("returns the correct class for a valid key", () => {
    expect(getClassDef("necromancer").name).toBe("Necromancer");
    expect(getClassDef("paladin").name).toBe("Paladin");
    expect(getClassDef("bard").name).toBe("Bard");
  });

  it("returns fighter as default for unknown key", () => {
    expect(getClassDef("dragon").name).toBe("Fighter");
  });

  it("returns fighter for null", () => {
    expect(getClassDef(null).name).toBe("Fighter");
  });

  it("returns fighter for undefined", () => {
    expect(getClassDef(undefined).name).toBe("Fighter");
  });
});

describe("CLASS_GROUPS", () => {
  it("has 4 groups: warrior, nature, arcane, holy", () => {
    const keys = CLASS_GROUPS.map(g => g.key);
    expect(keys).toContain("warrior");
    expect(keys).toContain("nature");
    expect(keys).toContain("arcane");
    expect(keys).toContain("holy");
  });

  it("every class belongs to one of the 4 groups", () => {
    const groupKeys = CLASS_GROUPS.map(g => g.key);
    for (const cls of CLASSES) {
      expect(groupKeys, `${cls.name} group '${cls.group}' is unknown`).toContain(cls.group);
    }
  });
});
