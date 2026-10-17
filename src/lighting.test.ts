import { describe, it, expect } from "vitest";
import { createLight, shadowSourceIds, roomLightPoint } from "./lightSources";
import { lightingProfiles, validLightSettings, MAX_LIGHTS } from "./lighting";
import { demo, validateProject, collides } from "./model";
import { inside, roomCeilingHeight } from "./spatial";
import { exportProject, importProject, saveProject, projects } from "./db";
import "fake-indexeddb/auto";
describe("Éclairage des appartements", () => {
  it("préserve une ambiance nuit et les sources dans IndexedDB et une archive complète", async () => {
    const p = demo();
    p.environment = { lighting: "night", exposure: 1.2 };
    p.items.push(createLight("spot"));
    validateProject(p);
    await saveProject(p);
    expect((await projects()).find((v) => v.id === p.id)?.environment).toEqual(
      p.environment,
    );
    const restored = await importProject(await exportProject(p));
    expect(restored.environment).toEqual(p.environment);
    expect(restored.items.find((i) => i.light)?.light).toEqual(
      p.items.at(-1)!.light,
    );
  });
  it("rejette une source invalide, une ambiance inconnue et un nombre excessif de sources", () => {
    const p = demo(),
      light = createLight("ceiling");
    p.items.push(light);
    expect(validLightSettings(light.light)).toBe(true);
    for (const patch of [
      { lumens: Infinity },
      { lumens: -1 },
      { lumens: 10001 },
      { range: 0 },
      { angle: 180 },
      { tilt: 91 },
      { color: "#fff" },
      { enabled: "true" },
    ])
      expect(validLightSettings({ ...light.light, ...patch })).toBe(false);
    light.light!.lumens = -1;
    expect(() => validateProject(p)).toThrow("Source");
    p.items = [];
    p.environment = { lighting: "invalid" as "night", exposure: 1 };
    expect(() => validateProject(p)).toThrow("Ambiance");
    delete p.environment;
    p.items = Array.from({ length: MAX_LIGHTS + 1 }, () =>
      createLight("ceiling"),
    );
    expect(() => validateProject(p)).toThrow("Maximum");
  });
  it("limite les ombres aux deux premières sources actives qui les demandent", () => {
    const p = demo();
    p.items = Array.from({ length: 4 }, () => createLight("ceiling"));
    p.items[0].light!.enabled = false;
    expect([...shadowSourceIds(p)]).toEqual([p.items[1].id, p.items[2].id]);
    p.items[1].light!.shadows = false;
    expect([...shadowSourceIds(p)]).toEqual([p.items[2].id, p.items[3].id]);
    expect(lightingProfiles.night.sun).toBeLessThan(
      lightingProfiles.daylight.sun / 10,
    );
  });
  it("place une source dans une pièce concave et évite de la signaler comme collision", () => {
    const p = demo();
    const room = {
      ...p.rooms[0],
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 6 },
        { x: 0, y: 6 },
      ],
    };
    expect(inside(roomLightPoint(room), room.points)).toBe(true);
    const light = createLight("accent");
    light.x = p.items[0].x;
    light.y = p.items[0].y;
    light.elevation = 0;
    p.items.push(light);
    expect(collides(light, p)).toBe(false);
  });
});

it("adapte la hauteur du plafond aux murs de la pièce, sans prendre les murs perpendiculaires d’une autre pièce", () => {
  const p = demo(),
    room = p.rooms[0];
  p.walls.forEach((w) => (w.height = 3));
  expect(roomCeilingHeight(room, p.walls)).toBe(3);
  p.walls.push({
    id: "taller",
    a: { x: 5, y: 0 },
    b: { x: 6, y: 1 },
    height: 4,
    thickness: 0.15,
    color: "#ffffff",
    openings: [],
  });
  expect(roomCeilingHeight(room, p.walls)).toBe(3);
  expect(roomCeilingHeight(room, [])).toBe(2.6);
});
