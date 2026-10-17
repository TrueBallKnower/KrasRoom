import { it, expect } from "vitest";
import { demo, type Wall } from "./model";
import {
  openingArea,
  quantities,
  technicalSvg,
  quantityCsv,
} from "./architecture";
it("calcule des quantités nettes sans soustraire deux fois les ouvertures superposées", () => {
  const p = demo();
  const wall: Wall = {
    id: "wall",
    a: { x: 0, y: 0 },
    b: { x: 4, y: 0 },
    height: 3,
    thickness: 0.2,
    color: "#ffffff",
    openings: [
      { id: "a", kind: "window", offset: 1, width: 2, sill: 1, height: 1 },
      { id: "b", kind: "window", offset: 2, width: 2, sill: 1, height: 1 },
      { id: "c", kind: "window", offset: 3, width: 2, sill: 2, height: 2 },
    ],
  };
  p.walls = [wall];
  p.rooms = [];
  expect(openingArea(wall)).toBe(4);
  const q = quantities(p);
  expect(q.length).toBe(4);
  expect(q.wallFaces).toBe(16);
  expect(q.volume).toBeCloseTo(1.6);
});
it("exporte un SVG en millimètres dont l’échelle physique est exacte et échappe les noms", () => {
  const p = demo();
  p.name = '<script>&"';
  for (const scale of [50, 100, 200] as const) {
    const svg = technicalSvg(p, scale);
    const width = Number(svg.match(/width="([\d.]+)mm"/)![1]);
    const vb = svg
      .match(/viewBox="([^"]+)"/)![1]
      .split(" ")
      .map(Number);
    expect(width / vb[2]).toBeCloseTo(1000 / scale);
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain(`1:${scale}`);
  }
  p.walls = [];
  p.rooms = [];
  expect(() => technicalSvg(p, 100)).toThrow("Ajoutez");
});
it("produit un CSV exploitable sans formules provenant des noms de pièce", () => {
  const p = demo();
  p.rooms[0].name = '=HYPERLINK("x")';
  const csv = quantityCsv(p);
  expect(csv).toContain('"\'=HYPERLINK(""x"")"');
  expect(csv).toContain('"48.000"');
  expect(csv.startsWith("\ufeff")).toBe(true);
});
