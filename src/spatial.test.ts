import { describe, it, expect } from "vitest";
import { wallOutline, visitStart, inside } from "./spatial";
import { blank, type Wall } from "./model";
const wall = (
  id: string,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thickness: 0.2,
  height: 2.6,
  color: "#fff",
  openings: [],
});
describe("Jonctions et visite", () => {
  it("raccorde les deux faces à angle droit sans modifier les axes", () => {
    const a = wall("a", 0, 0, 4, 0),
      b = wall("b", 4, 0, 4, 3),
      walls = [a, b];
    const x = wallOutline(a, walls),
      y = wallOutline(b, walls);
    expect(x[1].x).toBeCloseTo(y[0].x);
    expect(x[1].y).toBeCloseTo(y[0].y);
    expect(x[2].x).toBeCloseTo(y[3].x);
    expect(x[2].y).toBeCloseTo(y[3].y);
    expect(a.b).toEqual({ x: 4, y: 0 });
  });
  it("conserve des coins finis pour des murs alignés et des angles très aigus", () => {
    const a = wall("a", 0, 0, 4, 0);
    for (const b of [wall("b", 4, 0, 8, 0), wall("b", 4, 0, 0.01, 0.01)])
      expect(
        wallOutline(a, [a, b]).every(
          (p) =>
            Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) < 5,
        ),
      ).toBe(true);
  });
  it("démarre dans une pièce décalée et évite le meuble central", () => {
    const p = blank();
    p.rooms = [
      {
        id: "r",
        name: "Pièce",
        color: "#fff",
        points: [
          { x: 20, y: 10 },
          { x: 26, y: 10 },
          { x: 26, y: 16 },
          { x: 20, y: 16 },
        ],
      },
    ];
    p.walls = [
      wall("a", 20, 10, 26, 10),
      wall("b", 26, 10, 26, 16),
      wall("c", 26, 16, 20, 16),
      wall("d", 20, 16, 20, 10),
    ];
    p.items = [
      {
        id: "sofa",
        name: "Canapé",
        kind: "sofa",
        x: 23,
        y: 13,
        width: 2,
        depth: 2,
        height: 1,
        rotation: 0,
        color: "#fff",
      },
    ];
    const q = visitStart(p);
    expect(inside(q, p.rooms[0].points)).toBe(true);
    expect(Math.abs(q.x - 23) > 1.25 || Math.abs(q.y - 13) > 1.25).toBe(true);
  });
});
