import { inside } from "./spatial";
import { segmentDistance, uid, type Item, type Project } from "./model";
import { MAX_LIGHTS } from "./lighting";
export const lightPresets = {
  ceiling: {
    name: "Plafonnier",
    elevation: 2.35,
    type: "point",
    lumens: 1600,
    color: "#fff1d6",
  },
  spot: {
    name: "Spot orientable",
    elevation: 2.35,
    type: "spot",
    lumens: 1100,
    color: "#fff1d6",
  },
  accent: {
    name: "Lumière d’ambiance",
    elevation: 1.2,
    type: "point",
    lumens: 600,
    color: "#b7ceff",
  },
} as const;
export function createLight(preset: keyof typeof lightPresets): Item {
  const p = lightPresets[preset];
  return {
    id: uid(),
    name: p.name,
    kind: "light",
    x: 3,
    y: 3,
    rotation: 0,
    width: 0.22,
    depth: 0.22,
    height: 0.12,
    color: p.color,
    elevation: p.elevation,
    light: {
      type: p.type,
      enabled: true,
      lumens: p.lumens,
      color: p.color,
      range: 12,
      angle: 60,
      tilt: 0,
      shadows: true,
    },
  };
}
// Shadow maps are the expensive part: two local sources at most, even in HQ.
export function shadowSourceIds(project: Project): Set<string> {
  return new Set(
    project.items
      .filter(
        (i) =>
          i.kind === "light" &&
          i.light?.enabled &&
          i.light.lumens > 0 &&
          i.light.shadows,
      )
      .slice(0, Math.min(2, MAX_LIGHTS))
      .map((i) => i.id),
  );
}

export function roomLightPoint(
  room: import("./model").Room,
): import("./model").Point {
  const points = room.points;
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const width = Math.max(...xs) - minX,
    depth = Math.max(...ys) - minY;
  let best = points[0] || { x: 0, y: 0 },
    clearance = -1;
  for (let x = 0; x < 24; x++)
    for (let y = 0; y < 24; y++) {
      const q = {
        x: minX + ((x + 0.5) * width) / 24,
        y: minY + ((y + 0.5) * depth) / 24,
      };
      if (!inside(q, points)) continue;
      const score = Math.min(
        ...points.map((a, i) =>
          segmentDistance(q, a, points[(i + 1) % points.length]),
        ),
      );
      if (score > clearance) {
        clearance = score;
        best = q;
      }
    }
  return best;
}
