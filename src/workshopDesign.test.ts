import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  buildDesign,
  designPreset,
  designPart,
  designSize,
  disposeDesign,
  validateDesign,
  designFromModel,
  DESIGN_LIMIT,
} from "./workshopDesign";
import { loadDesignDraft, saveDesignDraft } from "./workshopDraft";
describe("Création de meubles en mètres", () => {
  it("construit une table aux dimensions réelles avec uniquement ses cinq objets", () => {
    const d = designPreset(),
      group = buildDesign(d),
      s = designSize(group);
    expect([s.x, s.y, s.z]).toEqual([1.4, 0.75, 0.8]);
    expect(group.children).toHaveLength(5);
    expect(group.children.every((c) => c.type === "Mesh")).toBe(true);
    disposeDesign(group);
  });
  it("respecte les ellipsoïdes, cylindres et rotations", () => {
    for (const shape of ["cylinder", "sphere", "box"] as const) {
      const d = {
        version: 1 as const,
        name: "Forme",
        parts: [
          { ...designPart(shape), width: 2, depth: 0.5, height: 3, ry: 90 },
        ],
      };
      const group = buildDesign(d),
        s = designSize(group);
      expect(s.x).toBeCloseTo(0.5);
      expect(s.y).toBeCloseTo(3);
      expect(s.z).toBeCloseTo(2);
      disposeDesign(group);
    }
  });
  it("conserve une recette indépendante et un brouillon IndexedDB réellement rechargeable", async () => {
    const d = designPreset("shelf"),
      group = buildDesign(d);
    const recipe = designFromModel(group)!;
    recipe.name = "Copie";
    expect(d.name).not.toBe("Copie");
    await saveDesignDraft(d);
    expect(await loadDesignDraft()).toEqual(d);
    disposeDesign(group);
  });
  it("rejette les géométries invalides et les créations trop lourdes", () => {
    const d = designPreset();
    d.parts[0].width = NaN;
    expect(() => validateDesign(d)).toThrow();
    d.parts[0].width = 0;
    expect(() => validateDesign(d)).toThrow();
    d.parts = Array.from({ length: DESIGN_LIMIT + 1 }, () => designPart());
    expect(() => validateDesign(d)).toThrow();
    d.parts = [designPart()];
    d.parts.push({ ...d.parts[0] });
    expect(() => validateDesign(d)).toThrow();
  });
});
