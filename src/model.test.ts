import { describe, it, expect } from "vitest";
import {
  area,
  distance,
  segmentDistance,
  corners,
  overlaps,
  collides,
  demo,
  furniture,
  catalog,
  validateProject,
} from "./model";
describe("Géométrie en mètres", () => {
  it("mesure une distance et une surface exactes", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(
      area([
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 6 },
        { x: 0, y: 6 },
      ]),
    ).toBe(48);
  });
  it("projette sur un segment fini", () => {
    expect(
      segmentDistance({ x: 4, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 }),
    ).toBe(2);
  });
  it("conserve les dimensions après rotation", () => {
    const i = furniture(catalog[0]);
    i.rotation = 37;
    const c = corners(i);
    expect(distance(c[0], c[1])).toBeCloseTo(i.width);
    expect(distance(c[1], c[2])).toBeCloseTo(i.depth);
  });
  it("détecte les collisions orientées sans confondre des objets éloignés", () => {
    const a = furniture(catalog[0]),
      b = { ...a, id: "other", x: a.x + 0.1, rotation: 45 };
    expect(overlaps(corners(a), corners(b))).toBe(true);
    b.x = 20;
    expect(overlaps(corners(a), corners(b))).toBe(false);
  });
  it("détecte un meuble qui traverse un mur", () => {
    const p = demo(),
      i = { ...furniture(catalog[0]), x: 0, y: 2 };
    expect(collides(i, p)).toBe(true);
  });
  it("rejette des dimensions et coordonnées invalides", () => {
    const p = demo();
    validateProject(p);
    p.items[0].width = -1;
    expect(() => validateProject(p)).toThrow();
    p.items[0].width = 1;
    p.walls[0].a.x = NaN;
    expect(() => validateProject(p)).toThrow();
  });
});

it("aligne un meuble sur un mur incliné en respectant son épaisseur", async () => {
  const { againstWall } = await import("./model");
  const i = furniture(catalog[0]),
    w = {
      id: "w",
      a: { x: 0, y: 0 },
      b: { x: 8, y: 8 },
      thickness: 0.2,
      height: 2.6,
      color: "#fff",
      openings: [],
    };
  const aligned = againstWall(i, [w]);
  expect(aligned.rotation).toBeCloseTo(45);
  expect(segmentDistance(aligned, w.a, w.b)).toBeCloseTo(
    (i.depth + w.thickness) / 2,
  );
});
