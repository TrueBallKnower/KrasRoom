import {
  distance,
  occupiedItems,
  segmentDistance,
  type Point,
  type Project,
} from "./model";

export const WALK_RADIUS = 0.18;
/** Build once when the plan changes, rather than scanning model geometry per frame. */
export function walkObstacles(
  p: Project,
  eyeHeight: number,
  radius = WALK_RADIUS,
) {
  const segments: { a: Point; b: Point; radius: number }[] = [];
  for (const w of p.walls) {
    const length = distance(w.a, w.b);
    if (length < 0.001 || w.height < 0.15) continue;
    const point = (t: number) => ({
      x: w.a.x + ((w.b.x - w.a.x) * t) / length,
      y: w.a.y + ((w.b.y - w.a.y) * t) / length,
    });
    const doors = w.openings
      .filter(
        (o) =>
          o.kind === "door" && o.sill <= 0.08 && o.height >= eyeHeight + 0.1,
      )
      .map((o) => [
        Math.min(length, Math.max(0, o.offset)),
        Math.min(length, o.offset + o.width),
      ])
      .sort((a, b) => a[0] - b[0]);
    let end = 0;
    for (const [a, b] of [...doors, [length, length]]) {
      if (a > end)
        segments.push({
          a: point(end),
          b: point(a),
          radius: w.thickness / 2 + radius,
        });
      end = Math.max(end, b);
    }
  }
  const boxes = p.items
    .flatMap(occupiedItems)
    .filter((v) => v.top > 0.15 && v.bottom < eyeHeight + 0.1)
    .map(({ item: i }) => {
      const angle = (i.rotation * Math.PI) / 180;
      return {
        x: i.x,
        y: i.y,
        c: Math.cos(angle),
        s: Math.sin(angle),
        w: i.width / 2,
        d: i.depth / 2,
      };
    });
  return (q: Point) =>
    segments.some((s) => segmentDistance(q, s.a, s.b) < s.radius) ||
    boxes.some((b) => {
      const dx = q.x - b.x,
        dy = q.y - b.y;
      const x = Math.max(0, Math.abs(dx * b.c + dy * b.s) - b.w),
        y = Math.max(0, Math.abs(-dx * b.s + dy * b.c) - b.d);
      return x * x + y * y < radius * radius;
    });
}
/** Short swept steps prevent tunnelling; resolve each axis to slide along obstacles. */
export function walkStep(
  from: Point,
  dx: number,
  dy: number,
  blocked: (p: Point) => boolean,
): Point {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.06));
  let q = { ...from };
  for (let i = 0; i < steps; i++) {
    const next = { x: q.x + dx / steps, y: q.y + dy / steps };
    if (!blocked(next)) {
      q = next;
      continue;
    }
    const x = { x: next.x, y: q.y };
    if (!blocked(x)) q = x;
    const y = { x: q.x, y: next.y };
    if (!blocked(y)) q = y;
  }
  return q;
}
/** Normalise diagonals, but preserve analogue joystick magnitude. */
export function walkInput(x: number, y: number) {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/** Start facing open space instead of an arbitrary compass direction. */
export function walkHeading(from: Point, blocked: (p: Point) => boolean) {
  let heading = 0,
    best = -1;
  for (let i = 0; i < 32; i++) {
    const angle = (i * Math.PI) / 16;
    let clear = 0;
    for (let d = 0.15; d <= 8; d += 0.15) {
      if (
        blocked({
          x: from.x + Math.cos(angle) * d,
          y: from.y + Math.sin(angle) * d,
        })
      )
        break;
      clear = d;
    }
    if (clear > best) {
      best = clear;
      heading = angle;
    }
  }
  return heading;
}
