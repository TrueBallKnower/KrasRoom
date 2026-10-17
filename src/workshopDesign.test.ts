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
  furnitureComponent,
  transformedPart,
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
  it("propose des assemblages de mobilier valides et des composants aux bonnes dimensions", () => {
    for (const kind of [
      "table",
      "desk",
      "shelf",
      "cabinet",
      "bench",
      "empty",
    ]) {
      const d = designPreset(kind);
      validateDesign(d);
      const group = buildDesign(d);
      expect(designSize(group).length()).toBeGreaterThan(0.1);
      disposeDesign(group);
    }
    expect(furnitureComponent("leg").height).toBe(0.7);
    expect(furnitureComponent("top").elevation).toBe(0.7);
  });
  it("convertit les gestes du gizmo en positions, dimensions et degrés sauvegardables", () => {
    const p = designPart(),
      g = buildDesign({ version: 1, name: "Test", parts: [p] }),
      m = g.children[0];
    m.position.set(0.4, 1, 0.6);
    m.scale.set(2, 0.8, 0.7);
    m.rotation.y = Math.PI / 2;
    const next = transformedPart(p, m);
    expect(next).toMatchObject({
      x: 0.4,
      z: 0.6,
      elevation: 0.6,
      width: 2,
      height: 0.8,
      depth: 0.7,
      ry: 90,
    });
    validateDesign({ version: 1, name: "Test", parts: [next] });
    m.scale.x = -0.001;
    m.position.x = 99;
    expect(transformedPart(p, m)).toMatchObject({ width: 0.01, x: 50 });
    disposeDesign(g);
  });
});
