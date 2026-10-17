import { describe, it, expect } from "vitest";
import { demo, type Wall, type Project } from "./model";
import { walkInput, walkObstacles, walkStep, walkHeading } from "./visitMotion";
const wall: Wall = {
  id: "wall",
  a: { x: 0, y: 0 },
  b: { x: 4, y: 0 },
  thickness: 0.2,
  height: 2.5,
  color: "#fff",
  openings: [],
};
function plan(w: Wall = wall): Project {
  return { ...demo(), walls: [w], items: [] };
}
describe("Déplacement à hauteur humaine", () => {
  it("empêche de traverser un mur, même lors d'un déplacement rapide", () => {
    const q = walkStep({ x: 2, y: -2 }, 0, 4, walkObstacles(plan(), 1.65));
    expect(q.y).toBeLessThan(-0.27);
    expect(q.y).toBeGreaterThan(-0.35);
  });
  it("glisse contre le mur sans immobiliser le déplacement latéral", () => {
    const q = walkStep({ x: 1, y: -0.3 }, 1, 1, walkObstacles(plan(), 1.65));
    expect(q.x).toBeCloseTo(2);
    expect(q.y).toBeLessThan(-0.27);
  });
  it("traverse une porte à sa vraie position, mais pas les jambages ni une fenêtre", () => {
    const opening = {
      id: "door",
      kind: "door" as const,
      offset: 1,
      width: 0.9,
      height: 2.1,
      sill: 0,
    };
    const p = plan({ ...wall, openings: [opening] });
    expect(
      walkStep({ x: 1.45, y: -1 }, 0, 2, walkObstacles(p, 1.65)).y,
    ).toBeCloseTo(1);
    expect(
      walkStep({ x: 0.95, y: -1 }, 0, 2, walkObstacles(p, 1.65)).y,
    ).toBeLessThan(0);
    p.walls[0].openings[0] = { ...opening, kind: "window" };
    expect(
      walkStep({ x: 1.45, y: -1 }, 0, 2, walkObstacles(p, 1.65)).y,
    ).toBeLessThan(0);
  });
  it("refuse les passages trop bas et respecte les meubles tournés", () => {
    const p = plan({
      ...wall,
      openings: [
        { id: "door", kind: "door", offset: 1, width: 1, height: 1.5, sill: 0 },
      ],
    });
    expect(walkObstacles(p, 1.65)({ x: 1.5, y: 0 })).toBe(true);
    p.walls = [];
    p.items = [
      {
        ...demo().items[0],
        x: 0,
        y: 0,
        width: 2,
        depth: 0.5,
        height: 1,
        rotation: 90,
      },
    ];
    const blocked = walkObstacles(p, 1.65);
    expect(blocked({ x: 0, y: 0.8 })).toBe(true);
    expect(blocked({ x: 0.8, y: 0 })).toBe(false);
  });
  it("laisse passer sous un objet haut et sur un tapis, utilise les empreintes des modèles", () => {
    const p = plan();
    p.walls = [];
    const i = { ...demo().items[0], x: 0, y: 0, width: 2, depth: 2, height: 1 };
    p.items = [{ ...i, elevation: 2 }];
    expect(walkObstacles(p, 1.65)({ x: 0, y: 0 })).toBe(false);
    p.items = [{ ...i, kind: "rug" }];
    expect(walkObstacles(p, 1.65)({ x: 0, y: 0 })).toBe(false);
    p.items = [
      {
        ...i,
        footprints: [{ x: 0.4, y: 0, width: 0.2, depth: 1, bottom: 0, top: 1 }],
      },
    ];
    expect(walkObstacles(p, 1.65)({ x: 0, y: 0 })).toBe(false);
    expect(walkObstacles(p, 1.65)({ x: 0.8, y: 0 })).toBe(true);
  });
  it("oriente le regard vers un espace ouvert plutôt que vers le mur proche", () => {
    const heading = walkHeading(
      { x: 0, y: 0 },
      (q) => q.x > 0.3 || q.x < -4 || Math.abs(q.y) > 2,
    );
    expect(Math.cos(heading)).toBeLessThan(0);
  });
  it("conserve la vitesse progressive du joystick sans accélération diagonale", () => {
    expect(walkInput(0.2, 0.3)).toEqual({ x: 0.2, y: 0.3 });
    const v = walkInput(1, 1);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });
});
