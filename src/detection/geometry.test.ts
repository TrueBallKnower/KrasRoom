import { describe, it, expect } from "vitest";
import { detectPlan } from "./geometry";
import { reconstruct } from "./analyze";
import { area } from "../model";
function fixture() {
  const w = 360,
    h = 280,
    pixels = new Uint8ClampedArray(w * h * 4);
  pixels.fill(255);
  const rect = (x: number, y: number, a: number, b: number, value = 0) => {
    for (let j = y; j < y + b; j++)
      for (let i = x; i < x + a; i++) {
        const index = (j * w + i) * 4;
        pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
      }
  };
  return { w, h, pixels, rect };
}
function apartment() {
  const f = fixture();
  f.rect(25, 25, 310, 8);
  f.rect(25, 247, 310, 8);
  f.rect(25, 25, 8, 230);
  f.rect(327, 25, 8, 230);
  f.rect(200, 25, 7, 85);
  f.rect(200, 140, 7, 115);
  f.rect(25, 25, 100, 8);
  f.rect(125, 25, 50, 8, 255);
  f.rect(125, 27, 50, 1);
  f.rect(125, 30, 50, 1);
  return f;
}
describe("Reconnaissance locale de plans", () => {
  it("détecte murs, deux pièces et vitrage sans prendre les traits de cote pour des murs", () => {
    const f = apartment();
    f.rect(30, 270, 250, 1);
    const d = detectPlan(f.pixels, f.w, f.h);
    expect(d.walls.length).toBeGreaterThanOrEqual(5);
    expect(d.rooms).toHaveLength(2);
    expect(
      d.walls.some((w) => w.openings.some((o) => o.kind === "window")),
    ).toBe(true);
    expect(d.walls.some((w) => w.openings.some((o) => o.kind === "door"))).toBe(
      true,
    );
    expect(d.walls.some((w) => w.axis === "h" && w.center > 260)).toBe(false);
  });
  it("reconstruit une surface totale conforme au nombre saisi, sans prétendre à des cotes exactes", () => {
    const f = apartment(),
      d = detectPlan(f.pixels, f.w, f.h);
    const p = reconstruct(
      d,
      { asset: "plan", width: f.w, height: f.h, scale: 1 },
      48,
      "Appartement",
    );
    expect(p.rooms.reduce((s, r) => s + area(r.points), 0)).toBeCloseTo(48, 6);
    expect(p.analysis?.estimated).toBe(true);
    expect(p.walls.every((w) => w.height === 2.6)).toBe(true);
    expect(
      p.walls.flatMap((w) => w.openings).every((o) => !o.detection?.reviewed),
    ).toBe(true);
  });
  it("refuse de fabriquer un appartement à partir d’une image vide ou de traits ouverts", () => {
    const f = fixture();
    f.rect(20, 30, 200, 7);
    const d = detectPlan(f.pixels, f.w, f.h);
    expect(d.rooms).toHaveLength(0);
    expect(() =>
      reconstruct(
        d,
        { asset: "plan", width: f.w, height: f.h, scale: 1 },
        48,
        "Plan",
      ),
    ).toThrow("contour");
  });
  it("garde la forme concave des pièces plutôt que leur rectangle englobant", () => {
    const f = fixture();
    f.rect(20, 20, 220, 8);
    f.rect(20, 20, 8, 210);
    f.rect(20, 222, 100, 8);
    f.rect(112, 120, 8, 110);
    f.rect(112, 120, 128, 8);
    f.rect(232, 20, 8, 108);
    const d = detectPlan(f.pixels, f.w, f.h);
    expect(d.rooms).toHaveLength(1);
    expect(d.rooms[0].length).toBeGreaterThanOrEqual(6);
    expect(d.pixelArea).toBeLessThan(220 * 210);
  });
  it("ne transforme pas des lettres courtes en structure", () => {
    const f = fixture();
    for (let x = 20; x < 260; x += 20) {
      f.rect(x, 50, 5, 15);
      f.rect(x, 50, 12, 3);
    }
    const d = detectPlan(f.pixels, f.w, f.h);
    expect(d.rooms).toHaveLength(0);
    expect(d.walls).toHaveLength(0);
  });
});

it("recalibre le bâti et les positions sans agrandir un meuble dont les dimensions sont connues", async () => {
  const { calibrateAutomaticPlan, furniture, catalog } =
    await import("../model");
  const f = apartment(),
    d = detectPlan(f.pixels, f.w, f.h),
    p = reconstruct(
      d,
      { asset: "plan", width: f.w, height: f.h, scale: 1 },
      48,
      "Appartement",
    );
  p.items.push(furniture(catalog[0]));
  const width = p.items[0].width;
  calibrateAutomaticPlan(p, 2);
  expect(p.rooms.reduce((s, r) => s + area(r.points), 0)).toBeCloseTo(192);
  expect(p.items[0].x).toBe(6);
  expect(p.items[0].width).toBe(width);
});
