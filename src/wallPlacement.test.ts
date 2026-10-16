import { describe, it, expect } from "vitest";
import { Ray, Vector3 } from "three";
import { wallPlacement } from "./wallPlacement";
import { furniture, catalog, type Wall } from "./model";
const wall: Wall = {
  id: "wall",
  a: { x: 0, y: 0 },
  b: { x: 5, y: 0 },
  height: 2.6,
  thickness: 0.2,
  color: "#fff",
  openings: [],
};
const tv = { ...furniture(catalog[0]), width: 1.2, depth: 0.08, height: 0.7 };
describe("Fixation murale", () => {
  it("place l’écran à la hauteur visée sans traverser le mur", () => {
    const placed = wallPlacement(
      tv,
      [wall],
      new Ray(new Vector3(2, 1.5, 4), new Vector3(0, 0, -1)),
      false,
    )!;
    expect(placed.x).toBeCloseTo(2);
    expect(placed.y).toBeCloseTo(0.145);
    expect(placed.elevation).toBeCloseTo(1.15);
    expect(placed.rotation).toBe(0);
  });
  it("gère le côté opposé et les limites du mur", () => {
    const placed = wallPlacement(
      tv,
      [wall],
      new Ray(new Vector3(0.1, 2.55, -4), new Vector3(0, 0, 1)),
      true,
    )!;
    expect(placed.x).toBeCloseTo(0.6);
    expect(placed.y).toBeCloseTo(-0.145);
    expect(placed.rotation).toBe(180);
    expect(placed.elevation).toBeCloseTo(1.9);
  });
  it("gère les murs obliques et refuse un objet trop large ou un rayon hors mur", () => {
    const diagonal = { ...wall, b: { x: 4, y: 4 } };
    const placed = wallPlacement(
      tv,
      [diagonal],
      new Ray(new Vector3(2, 1, 5), new Vector3(0, 0, -1)),
      false,
    )!;
    expect(placed.rotation).toBe(45);
    expect(
      wallPlacement(
        { ...tv, width: 20 },
        [wall],
        new Ray(new Vector3(2, 1, 4), new Vector3(0, 0, -1)),
        false,
      ),
    ).toBeUndefined();
    expect(
      wallPlacement(
        tv,
        [wall],
        new Ray(new Vector3(20, 1, 4), new Vector3(0, 0, -1)),
        false,
      ),
    ).toBeUndefined();
  });
});
