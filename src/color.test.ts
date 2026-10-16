import { describe, it, expect } from "vitest";
import { colorPalette, hexToHsv, hsvToHex } from "./color";
import { floorFinishes, wallFinishes } from "./floorFinishes";
import { demo, validateProject } from "./model";
describe("Couleurs et matériaux", () => {
  it("convertit la roue HSV en couleurs exactes, y compris le noir et le blanc", () => {
    expect(hsvToHex(0, 1, 1)).toBe("#ff0000");
    expect(hsvToHex(120, 1, 1)).toBe("#00ff00");
    expect(hsvToHex(240, 1, 1)).toBe("#0000ff");
    for (const hex of [
      ...colorPalette.map((p) => p[1]),
      "#000000",
      "#ffffff",
    ]) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
  });
  it("accepte les finitions du catalogue et les anciennes sauvegardes", () => {
    const p = demo();
    expect(() => validateProject(p)).not.toThrow();
    for (const f of floorFinishes) {
      p.rooms[0].finish = f.id;
      expect(() => validateProject(p)).not.toThrow();
    }
    for (const f of wallFinishes) {
      p.walls[0].finish = f.id;
      expect(() => validateProject(p)).not.toThrow();
    }
  });
  it("refuse les échelles, angles, couleurs et finitions invalides", () => {
    const p = demo();
    p.walls[0].textureScale = 0;
    expect(() => validateProject(p)).toThrow();
    p.walls[0].textureScale = 1;
    p.rooms[0].textureAngle = Infinity;
    expect(() => validateProject(p)).toThrow();
    p.rooms[0].textureAngle = 45;
    p.rooms[0].tint = "rouge";
    expect(() => validateProject(p)).toThrow();
  });
});
