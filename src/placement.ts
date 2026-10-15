import {
  corners,
  distance,
  segmentDistance,
  type Item,
  type Point,
  type Project,
  type Wall,
} from "./model";
export type AlignmentGuide = { a: Point; b: Point };
function extents(i: Item) {
  const pts = corners(i);
  return {
    minX: Math.min(...pts.map((q) => q.x)),
    maxX: Math.max(...pts.map((q) => q.x)),
    minY: Math.min(...pts.map((q) => q.y)),
    maxY: Math.max(...pts.map((q) => q.y)),
  };
}
export function magneticPlacement(
  item: Item,
  p: Project,
  tolerance = 0.1,
): { item: Item; guides: AlignmentGuide[] } {
  let out = {
    ...item,
    x: Math.round(item.x * 20) / 20,
    y: Math.round(item.y * 20) / 20,
  };
  const a = extents(out);
  let bestX = tolerance,
    bestY = tolerance,
    dx = 0,
    dy = 0,
    gx: AlignmentGuide | undefined,
    gy: AlignmentGuide | undefined;
  for (const other of p.items) {
    if (other.id === item.id) continue;
    const b = extents(other);
    for (const x of [a.minX, (a.minX + a.maxX) / 2, a.maxX])
      for (const xx of [b.minX, (b.minX + b.maxX) / 2, b.maxX])
        if (Math.abs(xx - x) < bestX) {
          bestX = Math.abs(xx - x);
          dx = xx - x;
          gx = {
            a: { x: xx, y: Math.min(a.minY, b.minY) - 0.3 },
            b: { x: xx, y: Math.max(a.maxY, b.maxY) + 0.3 },
          };
        }
    for (const y of [a.minY, (a.minY + a.maxY) / 2, a.maxY])
      for (const yy of [b.minY, (b.minY + b.maxY) / 2, b.maxY])
        if (Math.abs(yy - y) < bestY) {
          bestY = Math.abs(yy - y);
          dy = yy - y;
          gy = {
            a: { x: Math.min(a.minX, b.minX) - 0.3, y: yy },
            b: { x: Math.max(a.maxX, b.maxX) + 0.3, y: yy },
          };
        }
  }
  out.x += dx;
  out.y += dy;
  let bestWall = tolerance,
    wallDelta: Point | undefined,
    wallGuide: AlignmentGuide | undefined;
  for (const w of p.walls) {
    const len = distance(w.a, w.b);
    if (len < 0.01) continue;
    const ux = (w.b.x - w.a.x) / len,
      uy = (w.b.y - w.a.y) / len,
      nx = -uy,
      ny = ux;
    const t = (out.x - w.a.x) * ux + (out.y - w.a.y) * uy;
    if (t < 0 || t > len) continue;
    const signed = (out.x - w.a.x) * nx + (out.y - w.a.y) * ny,
      side = signed >= 0 ? 1 : -1;
    const extent = Math.max(
      ...corners(out).map((q) =>
        Math.abs((q.x - out.x) * nx + (q.y - out.y) * ny),
      ),
    );
    const gap = Math.abs(signed) - extent - w.thickness / 2;
    if (Math.abs(gap) < bestWall) {
      bestWall = Math.abs(gap);
      wallDelta = { x: -gap * side * nx, y: -gap * side * ny };
      wallGuide = { a: w.a, b: w.b };
    }
  }
  if (wallDelta) {
    out.x += wallDelta.x;
    out.y += wallDelta.y;
  }
  return {
    item: out,
    guides: [
      ...(wallGuide ? [wallGuide] : []),
      ...(gx ? [gx] : []),
      ...(gy ? [gy] : []),
    ],
  };
}
export function edgeWallDistance(item: Item, wall: Wall) {
  const angle = (-item.rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  if (
    [wall.a, wall.b].some((q) => {
      const x = q.x - item.x,
        y = q.y - item.y;
      return (
        Math.abs(x * c - y * s) <= item.width / 2 &&
        Math.abs(x * s + y * c) <= item.depth / 2
      );
    })
  )
    return 0;
  const pts = corners(item);
  let min = Infinity;
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k],
      b = pts[(k + 1) % pts.length];
    min = Math.min(
      min,
      segmentDistance(a, wall.a, wall.b),
      segmentDistance(b, wall.a, wall.b),
      segmentDistance(wall.a, a, b),
      segmentDistance(wall.b, a, b),
    );
    const cross = (p: Point, q: Point, r: Point) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (
      cross(a, b, wall.a) * cross(a, b, wall.b) < 0 &&
      cross(wall.a, wall.b, a) * cross(wall.a, wall.b, b) < 0
    )
      return 0;
  }
  return Math.max(0, min - wall.thickness / 2);
}
export function resizeItem(
  item: Item,
  key: "width" | "depth" | "height",
  value: number,
  locked: boolean,
): Item {
  if (!Number.isFinite(value) || value <= 0)
    throw Error("La dimension doit être positive.");
  if (!locked) return { ...item, [key]: value };
  const factor = value / item[key];
  return {
    ...item,
    width: item.width * factor,
    depth: item.depth * factor,
    height: item.height * factor,
  };
}
export const unitFactors = { m: 1, cm: 0.01, mm: 0.001, in: 0.0254 } as const;
