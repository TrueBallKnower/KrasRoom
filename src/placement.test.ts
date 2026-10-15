import { describe, it, expect } from "vitest";
import {
  magneticPlacement,
  resizeItem,
  edgeWallDistance,
  unitFactors,
} from "./placement";
import { blank, furniture, catalog, collides } from "./model";
describe("Placement, échelle et empreintes", () => {
  it("redimensionne les trois axes proportionnellement et convertit les unités", () => {
    const i = furniture(catalog[0]);
    const resized = resizeItem(i, "width", 4.4, true);
    expect(resized.depth).toBeCloseTo(1.8);
    expect(resized.height).toBeCloseTo(1.7);
    expect(resizeItem(i, "width", 3, false).depth).toBe(i.depth);
    expect(unitFactors.in).toBe(0.0254);
    expect(unitFactors.cm * 183.587).toBeCloseTo(1.83587);
  });
  it("accroche un bord au mur sans changer la rotation", () => {
    const p = blank();
    p.walls = [
      {
        id: "w",
        a: { x: 0, y: 0 },
        b: { x: 6, y: 0 },
        height: 2.6,
        thickness: 0.2,
        color: "#fff",
        openings: [],
      },
    ];
    const i = { ...furniture(catalog[0]), x: 3, y: 0.59 };
    const placed = magneticPlacement(i, p);
    expect(placed.item.y).toBeCloseTo(0.55);
    expect(placed.item.rotation).toBe(0);
    expect(placed.guides).toHaveLength(1);
    expect(edgeWallDistance(placed.item, p.walls[0])).toBeCloseTo(0);
  });
  it("aligne les centres entre meubles proches", () => {
    const p = blank(),
      a = { ...furniture(catalog[0]), x: 3, y: 2 },
      b = { ...furniture(catalog[0]), x: 3.06, y: 4 };
    p.items = [a, b];
    expect(magneticPlacement(b, p).item.x).toBeCloseTo(3);
  });
  it("ne signale pas un meuble dans le vide d’un ensemble ou sur un tapis", () => {
    const p = blank(),
      set = {
        ...furniture(catalog[0]),
        x: 0,
        y: 0,
        width: 6,
        depth: 4,
        footprints: [
          { x: -0.4, y: 0, width: 0.15, depth: 0.5, bottom: 0, top: 1 },
          { x: 0.4, y: 0, width: 0.15, depth: 0.5, bottom: 0, top: 1 },
        ],
      };
    const small = {
      ...furniture(catalog[2]),
      x: 0,
      y: 0,
      width: 0.6,
      depth: 0.6,
    };
    p.items = [set, small];
    expect(collides(small, p)).toBe(false);
    small.x = -2.4;
    expect(collides(small, p)).toBe(true);
    p.items = [small, { ...furniture(catalog[16]), x: small.x, y: small.y }];
    expect(collides(small, p)).toBe(false);
  });
  it("tient compte des objets surélevés", () => {
    const p = blank(),
      a = { ...furniture(catalog[0]), x: 0, y: 0 },
      b = { ...furniture(catalog[2]), x: 0, y: 0, elevation: 2 };
    p.items = [a, b];
    expect(collides(a, p)).toBe(false);
  });
});
