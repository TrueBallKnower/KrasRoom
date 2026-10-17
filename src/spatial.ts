import { walkObstacles } from "./visitMotion";
import {
  distance,
  segmentDistance,
  type Point,
  type Wall,
  type Project,
} from "./model";
/** Offset intersections produce matching corners without extending room dimensions. */
export function wallOutline(w: Wall, walls: Wall[]): Point[] {
  const len = distance(w.a, w.b);
  if (len < 1e-6) return [w.a, w.a, w.a, w.a];
  const d = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
  function corner(at: Point, side: number, end: boolean): Point {
    const base = {
      x: at.x - ((d.y * w.thickness) / 2) * side,
      y: at.y + ((d.x * w.thickness) / 2) * side,
    };
    const neighbors = walls.filter(
      (v) =>
        v.id !== w.id &&
        (distance(v.a, at) < 0.001 || distance(v.b, at) < 0.001),
    );
    if (neighbors.length !== 1) return base;
    const v = neighbors[0],
      other = distance(v.a, at) < 0.001 ? v.b : v.a,
      l = distance(at, other);
    if (l < 1e-6) return base;
    const sign = end ? 1 : -1,
      vx = ((other.x - at.x) / l) * sign,
      vy = ((other.y - at.y) / l) * sign;
    const cross = d.x * vy - d.y * vx;
    if (Math.abs(cross) < 1e-5) return base;
    const q = {
      x: at.x - ((vy * v.thickness) / 2) * side,
      y: at.y + ((vx * v.thickness) / 2) * side,
    };
    const t = ((q.x - base.x) * vy - (q.y - base.y) * vx) / cross;
    // Bevel very sharp junctions rather than creating long spikes.
    if (Math.abs(t) > Math.min(len / 2, Math.max(w.thickness, v.thickness) * 3))
      return base;
    return { x: base.x + d.x * t, y: base.y + d.y * t };
  }
  return [
    corner(w.a, 1, false),
    corner(w.b, 1, true),
    corner(w.b, -1, true),
    corner(w.a, -1, false),
  ];
}
export function inside(q: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.y > q.y !== b.y > q.y &&
      q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x
    )
      hit = !hit;
  }
  return hit;
}
export function visitStart(p: Project, eyeHeight = 1.55): Point {
  const blocked = walkObstacles(p, eyeHeight, 0.4);
  let best: Point | undefined,
    score = -Infinity;
  for (const r of p.rooms) {
    const xs = r.points.map((v) => v.x),
      ys = r.points.map((v) => v.y);
    for (let x = Math.min(...xs) + 0.3; x < Math.max(...xs); x += 0.35)
      for (let y = Math.min(...ys) + 0.3; y < Math.max(...ys); y += 0.35) {
        const q = { x, y };
        if (!inside(q, r.points)) continue;
        const clearance = Math.min(
          ...p.walls.map((w) => segmentDistance(q, w.a, w.b) - w.thickness / 2),
          5,
        );
        if (!blocked(q) && clearance > score) {
          score = clearance;
          best = q;
        }
      }
  }
  return best || p.rooms[0]?.points[0] || p.walls[0]?.a || { x: 2, y: 2 };
}

/** Ceiling follows full-height boundary walls; short partitions do not lower it. */
export function roomCeilingHeight(
  room: import("./model").Room,
  walls: Wall[],
): number {
  const boundary = walls.filter((w) =>
    room.points.some((a, index) => {
      const b = room.points[(index + 1) % room.points.length];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy),
        wl = distance(w.a, w.b);
      if (len < 0.001 || wl < 0.001) return false;
      const cross = (w.b.x - w.a.x) * dy - (w.b.y - w.a.y) * dx;
      if (Math.abs(cross) / (len * wl) > 0.01) return false;
      if (
        Math.abs((w.a.x - a.x) * dy - (w.a.y - a.y) * dx) / len >
        w.thickness / 2 + 0.03
      )
        return false;
      const t0 = ((w.a.x - a.x) * dx + (w.a.y - a.y) * dy) / len;
      const t1 = ((w.b.x - a.x) * dx + (w.b.y - a.y) * dy) / len;
      return (
        Math.min(len, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > 0.01
      );
    }),
  );
  return Math.max(
    ...(boundary.length ? boundary : walls).map((w) => w.height),
    ...(walls.length ? [] : [2.6]),
  );
}
