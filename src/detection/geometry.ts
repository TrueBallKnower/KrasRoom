import { area, type Point } from "../model";
export type PixelOpening = {
  offset: number;
  width: number;
  kind: "door" | "window";
  confidence: number;
};
export type PixelWall = {
  axis: "h" | "v";
  start: number;
  end: number;
  center: number;
  thickness: number;
  openings: PixelOpening[];
};
export type Detection = {
  width: number;
  height: number;
  walls: PixelWall[];
  rooms: Point[][];
  pixelArea: number;
  warnings: string[];
};
export type Options = {
  threshold: number;
  minThickness: number;
  minLength: number;
  maxGap: number;
};
const median = (a: number[]) =>
  [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)];
/** Extract long dark strips; short lettering and fine dimension lines are rejected. */
function strips(
  mask: Uint8Array,
  w: number,
  h: number,
  axis: "h" | "v",
  options: Options,
): PixelWall[] {
  const along = axis === "h" ? w : h,
    across = axis === "h" ? h : w;
  type Group = {
    first: number;
    last: number;
    starts: number[];
    ends: number[];
  };
  const groups: Group[] = [];
  for (let row = 0; row < across; row++) {
    let start = -1,
      last = -1;
    const flush = () => {
      if (start < 0 || last - start + 1 < options.minLength) return;
      const end = last + 1;
      const group = groups.find(
        (g) =>
          g.last >= row - 3 &&
          g.last < row &&
          Math.abs(median(g.starts) - start) <
            Math.max(8, options.minThickness * 3) &&
          Math.abs(median(g.ends) - end) <
            Math.max(8, options.minThickness * 3),
      );
      if (group) {
        group.last = row;
        group.starts.push(start);
        group.ends.push(end);
      } else
        groups.push({ first: row, last: row, starts: [start], ends: [end] });
    };
    for (let col = 0; col <= along; col++) {
      const dark =
        col < along &&
        (axis === "h" ? mask[row * w + col] : mask[col * w + row]);
      if (dark) {
        if (start < 0) start = col;
        last = col;
      } else if (start >= 0 && (col - last > 2 || col === along)) {
        flush();
        start = -1;
        last = -1;
      }
    }
  }
  return groups
    .filter(
      (g) =>
        g.starts.length >= options.minThickness &&
        g.starts.length / (g.last - g.first + 1) >= 0.65 &&
        g.last - g.first + 1 < Math.min(w, h) * 0.09,
    )
    .map((g) => ({
      axis,
      start: median(g.starts),
      end: median(g.ends),
      center: (g.first + g.last) / 2,
      thickness: g.last - g.first + 1,
      openings: [],
    }));
}
function gapKind(
  mask: Uint8Array,
  w: number,
  h: number,
  wall: PixelWall,
  start: number,
  end: number,
): PixelOpening {
  const from = Math.ceil(start + 2),
    to = Math.floor(end - 2);
  let lines = 0,
    was = false;
  for (
    let r = Math.floor(wall.center - wall.thickness / 2 - 3);
    r <= Math.ceil(wall.center + wall.thickness / 2 + 3);
    r++
  ) {
    let ink = 0;
    for (let c = from; c < to; c++) {
      const x = wall.axis === "h" ? c : r,
        y = wall.axis === "h" ? r : c;
      if (x >= 0 && y >= 0 && x < w && y < h) ink += mask[y * w + x];
    }
    const present = ink / Math.max(1, to - from) > 0.65;
    if (present && !was) lines++;
    was = present;
  }
  // Thin continuous lines within a break suggest glazing; an empty break only suggests a door.
  return {
    offset: start - wall.start,
    width: end - start,
    kind: lines ? "window" : "door",
    confidence: lines >= 2 ? 0.8 : lines ? 0.6 : 0.4,
  };
}
function connect(
  strips: PixelWall[],
  mask: Uint8Array,
  w: number,
  h: number,
  options: Options,
): PixelWall[] {
  const result: PixelWall[] = [];
  for (const axis of ["h", "v"] as const) {
    const sorted = strips
      .filter((s) => s.axis === axis)
      .sort((a, b) => a.center - b.center || a.start - b.start);
    for (const candidate of sorted) {
      const group = result.find(
        (g) =>
          g.axis === axis &&
          Math.abs(g.center - candidate.center) <=
            Math.max(2, Math.min(g.thickness, candidate.thickness) * 0.6) &&
          candidate.start <= g.end + options.maxGap &&
          candidate.end >= g.start - options.maxGap,
      );
      if (!group) {
        result.push({ ...candidate, openings: [] });
        continue;
      }
      if (candidate.start > group.end + 3) {
        group.openings.push(
          gapKind(mask, w, h, group, group.end, candidate.start),
        );
      } else if (candidate.end < group.start - 3) {
        const gap = gapKind(mask, w, h, group, candidate.end, group.start);
        gap.offset = candidate.end - Math.min(group.start, candidate.start);
        group.openings = group.openings.map((o) => ({
          ...o,
          offset: o.offset + group.start - candidate.start,
        }));
        group.openings.push(gap);
      } else if (candidate.start < group.start) {
        const diff = group.start - candidate.start;
        group.openings = group.openings.map((o) => ({
          ...o,
          offset: o.offset + diff,
        }));
      }
      group.start = Math.min(group.start, candidate.start);
      group.end = Math.max(group.end, candidate.end);
      group.thickness = median([group.thickness, candidate.thickness]);
      group.center = (group.center + candidate.center) / 2;
    }
  }
  // Snap nearby perpendicular intersections, closing small scanning/antialiasing gaps.
  for (const a of result)
    for (const b of result)
      if (a.axis === "h" && b.axis === "v") {
        const tolerance = Math.max(a.thickness, b.thickness) * 1.5 + 2;
        if (
          b.center >= a.start - tolerance &&
          b.center <= a.end + tolerance &&
          a.center >= b.start - tolerance &&
          a.center <= b.end + tolerance
        ) {
          if (Math.abs(a.start - b.center) < tolerance) {
            const delta = a.start - b.center;
            a.start = b.center;
            a.openings = a.openings.map((o) => ({
              ...o,
              offset: o.offset + delta,
            }));
          }
          if (Math.abs(a.end - b.center) < tolerance) a.end = b.center;
          if (Math.abs(b.start - a.center) < tolerance) {
            const delta = b.start - a.center;
            b.start = a.center;
            b.openings = b.openings.map((o) => ({
              ...o,
              offset: o.offset + delta,
            }));
          }
          if (Math.abs(b.end - a.center) < tolerance) b.end = a.center;
        }
      }
  return result;
}
function simplify(points: Point[]): Point[] {
  return points.filter((p, i) => {
    const a = points[(i + points.length - 1) % points.length],
      b = points[(i + 1) % points.length];
    return (p.x - a.x) * (b.y - p.y) !== (p.y - a.y) * (b.x - p.x);
  });
}
/** Flood fill closed regions using detected structure, not text/furniture ink. */
function roomsFromWalls(
  walls: PixelWall[],
  width: number,
  height: number,
): Point[][] {
  const step = Math.max(1, Math.ceil(Math.max(width, height) / 400)),
    w = Math.ceil(width / step),
    h = Math.ceil(height / step);
  const barrier = new Uint8Array(w * h),
    labels = new Int32Array(w * h),
    queue = new Int32Array(w * h);
  labels.fill(-1);
  for (const wall of walls) {
    const a = Math.max(0, Math.floor(wall.start / step)),
      b = Math.min(
        wall.axis === "h" ? w - 1 : h - 1,
        Math.ceil(wall.end / step),
      );
    const c = Math.floor((wall.center - wall.thickness / 2) / step),
      d = Math.ceil((wall.center + wall.thickness / 2) / step);
    for (let i = a; i <= b; i++)
      for (let j = c; j <= d; j++) {
        const x = wall.axis === "h" ? i : j,
          y = wall.axis === "h" ? j : i;
        if (x >= 0 && y >= 0 && x < w && y < h) barrier[y * w + x] = 1;
      }
  }
  const result: Point[][] = [];
  let label = 0;
  for (let initial = 0; initial < w * h; initial++) {
    if (barrier[initial] || labels[initial] >= 0) continue;
    let head = 0,
      tail = 1,
      touches = false;
    queue[0] = initial;
    labels[initial] = label;
    while (head < tail) {
      const idx = queue[head++],
        x = idx % w,
        y = Math.floor(idx / w);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true;
      for (const n of [
        x > 0 ? idx - 1 : -1,
        x < w - 1 ? idx + 1 : -1,
        y > 0 ? idx - w : -1,
        y < h - 1 ? idx + w : -1,
      ])
        if (n >= 0 && !barrier[n] && labels[n] < 0) {
          labels[n] = label;
          queue[tail++] = n;
        }
    }
    if (!touches && tail * step * step > width * height * 0.002) {
      // Directed cell edges trace the actual concave contour, rather than a room bounding box.
      const edges = new Map<number, number[]>(),
        stride = w + 1;
      const edge = (ax: number, ay: number, bx: number, by: number) => {
        const key = ay * stride + ax;
        const list = edges.get(key) || [];
        list.push(by * stride + bx);
        edges.set(key, list);
      };
      for (let i = 0; i < tail; i++) {
        const idx = queue[i],
          x = idx % w,
          y = Math.floor(idx / w);
        if (y === 0 || labels[idx - w] !== label) edge(x, y, x + 1, y);
        if (x === w - 1 || labels[idx + 1] !== label)
          edge(x + 1, y, x + 1, y + 1);
        if (y === h - 1 || labels[idx + w] !== label)
          edge(x + 1, y + 1, x, y + 1);
        if (x === 0 || labels[idx - 1] !== label) edge(x, y + 1, x, y);
      }
      const contours: Point[][] = [];
      while (edges.size) {
        const start = edges.keys().next().value!;
        let current = start;
        const contour: Point[] = [];
        for (let count = 0; count <= tail * 4; count++) {
          contour.push({
            x: (current % stride) * step,
            y: Math.floor(current / stride) * step,
          });
          const list = edges.get(current);
          if (!list?.length) break;
          const next = list.pop()!;
          if (!list.length) edges.delete(current);
          current = next;
          if (current === start) break;
        }
        if (current === start && contour.length >= 4)
          contours.push(simplify(contour));
      }
      contours.sort((a, b) => area(b) - area(a));
      if (contours.length) result.push(contours[0]);
    }
    label++;
  }
  return result;
}
export function detectPlan(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  overrides: Partial<Options> = {},
): Detection {
  if (
    width < 20 ||
    height < 20 ||
    rgba.length !== width * height * 4 ||
    width * height > 1_500_000
  )
    throw Error("Image de détection invalide ou trop grande.");
  const dimension = Math.max(width, height),
    options: Options = {
      threshold: 170,
      minThickness: Math.max(3, Math.round(dimension / 320)),
      minLength: Math.max(18, Math.round(dimension * 0.035)),
      maxGap: Math.round(dimension * 0.18),
      ...overrides,
    };
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    const alpha = rgba[i * 4 + 3] / 255;
    const luminance =
      (0.2126 * rgba[i * 4] +
        0.7152 * rgba[i * 4 + 1] +
        0.0722 * rgba[i * 4 + 2]) *
        alpha +
      255 * (1 - alpha);
    mask[i] = luminance < options.threshold ? 1 : 0;
  }
  const candidates = [
    ...strips(mask, width, height, "h", options),
    ...strips(mask, width, height, "v", options),
  ];
  if (candidates.length > 1000)
    throw Error(
      "Le plan contient trop de traits ambigus. Essayez une image recadrée et nette.",
    );
  const walls = connect(candidates, mask, width, height, options),
    rooms = roomsFromWalls(walls, width, height),
    pixelArea = rooms.reduce((s, r) => s + area(r), 0);
  const warnings = [
    "Dimensions estimées à partir de la surface totale et des pièces détectées, pas de cotes lues sur le plan.",
    "Portes et fenêtres proposées à partir des ruptures de murs et des traits de vitrage : leur type et leur emplacement restent à vérifier.",
  ];
  if (!rooms.length)
    warnings.push(
      "Aucun contour fermé fiable : impossible de déduire une échelle à partir de la surface.",
    );
  if (walls.some((w) => w.thickness <= options.minThickness + 1))
    warnings.push(
      "Certains murs sont proches de l’épaisseur minimale détectable.",
    );
  return { width, height, walls, rooms, pixelArea, warnings };
}
