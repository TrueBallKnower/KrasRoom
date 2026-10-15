export type Point = { x: number; y: number };
export type Wall = {
  id: string;
  a: Point;
  b: Point;
  thickness: number;
  height: number;
  color: string;
  openings: Opening[];
  detection?: { confidence: number; reviewed: boolean };
};
export type Opening = {
  id: string;
  kind: "door" | "window";
  offset: number;
  width: number;
  height: number;
  sill: number;
  detection?: { confidence: number; reviewed: boolean };
};
export type Item = {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  elevation?: number;
  modelPart?: string;
  footprints?: {
    x: number;
    y: number;
    width: number;
    depth: number;
    bottom: number;
    top: number;
  }[];
  asset?: string;
  photo?: string;
  price?: string;
  url?: string;
};
export type Room = {
  id: string;
  name: string;
  points: Point[];
  color: string;
  finish?: import("./floorFinishes").FloorFinish;
};
export type Project = {
  version: 1;
  id: string;
  name: string;
  walls: Wall[];
  items: Item[];
  rooms: Room[];
  plan?: { asset: string; width: number; height: number; scale: number };
  updated: number;
  analysis?: {
    surface: number;
    estimated: true;
    warnings: string[];
    created: number;
  };
};
export const uid = () => crypto.randomUUID();
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const area = (p: Point[]) =>
  Math.abs(
    p.reduce((s, a, i) => {
      const b = p[(i + 1) % p.length];
      return s + a.x * b.y - b.x * a.y;
    }, 0),
  ) / 2;
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
export function corners(i: Item): Point[] {
  const r = (i.rotation * Math.PI) / 180;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => ({
    x:
      i.x +
      ((a * i.width) / 2) * Math.cos(r) -
      ((b * i.depth) / 2) * Math.sin(r),
    y:
      i.y +
      ((a * i.width) / 2) * Math.sin(r) +
      ((b * i.depth) / 2) * Math.cos(r),
  }));
}
export function overlaps(a: Point[], b: Point[]) {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length],
        axis = { x: -(q.y - p.y), y: q.x - p.x };
      const aa = a.map((v) => v.x * axis.x + v.y * axis.y),
        bb = b.map((v) => v.x * axis.x + v.y * axis.y);
      if (
        Math.max(...aa) <= Math.min(...bb) ||
        Math.max(...bb) <= Math.min(...aa)
      )
        return false;
    }
  return true;
}
export function occupiedItems(
  item: Item,
): { item: Item; bottom: number; top: number }[] {
  if (item.kind === "rug") return [];
  if (!item.footprints)
    return [
      {
        item,
        bottom: item.elevation || 0,
        top: (item.elevation || 0) + item.height,
      },
    ];
  const angle = (item.rotation * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  return item.footprints.map((f) => ({
    item: {
      ...item,
      x: item.x + f.x * item.width * c - f.y * item.depth * s,
      y: item.y + f.x * item.width * s + f.y * item.depth * c,
      width: f.width * item.width,
      depth: f.depth * item.depth,
    },
    bottom: (item.elevation || 0) + f.bottom * item.height,
    top: (item.elevation || 0) + f.top * item.height,
  }));
}
export function collides(i: Item, p: Project) {
  const parts = occupiedItems(i);
  if (!parts.length) return false;
  if (
    p.items.some(
      (j) =>
        j.id !== i.id &&
        overlaps(corners(i), corners(j)) &&
        parts.some((a) =>
          occupiedItems(j).some(
            (b) =>
              a.bottom < b.top - 0.005 &&
              b.bottom < a.top - 0.005 &&
              overlaps(corners(a.item), corners(b.item)),
          ),
        ),
    )
  )
    return true;
  return p.walls.some((w) => {
    const d = distance(w.a, w.b);
    if (d < 0.001) return false;
    const dx = (w.b.x - w.a.x) / d,
      dy = (w.b.y - w.a.y) / d,
      t = w.thickness / 2;
    const poly = [
      { x: w.a.x - dy * t, y: w.a.y + dx * t },
      { x: w.b.x - dy * t, y: w.b.y + dx * t },
      { x: w.b.x + dy * t, y: w.b.y - dx * t },
      { x: w.a.x + dy * t, y: w.a.y - dx * t },
    ];
    return parts.some(
      (a) => a.bottom < w.height && overlaps(corners(a.item), poly),
    );
  });
}

export const catalog = [
  ["Canapé", "sofa", 2.2, 0.9, 0.85, "Salon"],
  ["Fauteuil", "chair", 0.85, 0.85, 0.9, "Salon"],
  ["Table basse", "table", 1.1, 0.6, 0.4, "Salon"],
  ["Télévision", "tv", 1.2, 0.25, 0.8, "Salon"],
  ["Lit double", "bed", 1.6, 2, 0.65, "Chambre"],
  ["Armoire", "cabinet", 1.5, 0.6, 2.1, "Chambre"],
  ["Commode", "cabinet", 1.2, 0.5, 0.9, "Chambre"],
  ["Table de nuit", "cabinet", 0.45, 0.4, 0.5, "Chambre"],
  ["Table à manger", "table", 1.6, 0.9, 0.75, "Cuisine"],
  ["Chaise", "chair", 0.45, 0.5, 0.85, "Cuisine"],
  ["Meuble cuisine", "cabinet", 0.6, 0.6, 0.9, "Cuisine"],
  ["Bureau", "table", 1.4, 0.7, 0.75, "Bureau"],
  ["Étagère", "shelf", 0.9, 0.35, 1.8, "Bureau"],
  ["Lavabo", "sink", 0.7, 0.5, 0.85, "Salle de bain"],
  ["Douche", "shower", 0.9, 0.9, 2, "Salle de bain"],
  ["Lampe", "lamp", 0.4, 0.4, 1.6, "Décoration"],
  ["Tapis", "rug", 2, 1.5, 0.02, "Décoration"],
  ["Plante", "plant", 0.45, 0.45, 1, "Décoration"],
] as const;
export function furniture(c: (typeof catalog)[number]): Item {
  return {
    id: uid(),
    name: c[0],
    kind: c[1],
    width: c[2],
    depth: c[3],
    height: c[4],
    x: 3,
    y: 3,
    rotation: 0,
    color: "#b6a18d",
  };
}
export function blank(name = "Mon appartement"): Project {
  return {
    version: 1,
    id: uid(),
    name,
    walls: [],
    items: [],
    rooms: [],
    updated: Date.now(),
  };
}
export function demo(): Project {
  const p = blank("Appartement · 48 m²");
  const lines = [
    [0, 0, 8, 0],
    [8, 0, 8, 6],
    [8, 6, 0, 6],
    [0, 6, 0, 0],
    [5, 0, 5, 6],
    [5, 3, 8, 3],
  ];
  p.walls = lines.map(([x, y, u, v]) => ({
    id: uid(),
    a: { x, y },
    b: { x: u, y: v },
    thickness: 0.15,
    height: 2.6,
    color: "#e9e5de",
    openings: [],
  }));
  p.walls[4].openings = [
    { id: uid(), kind: "door", offset: 1, width: 0.9, height: 2.1, sill: 0 },
  ];
  p.walls[0].openings = [
    {
      id: uid(),
      kind: "window",
      offset: 1.4,
      width: 2,
      height: 1.3,
      sill: 0.9,
    },
  ];
  p.rooms = [
    {
      id: uid(),
      name: "Séjour",
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 6 },
        { x: 0, y: 6 },
      ],
      color: "#ddcbb4",
    },
    {
      id: uid(),
      name: "Chambre",
      points: [
        { x: 5, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 3 },
        { x: 5, y: 3 },
      ],
      color: "#d5d0c3",
    },
    {
      id: uid(),
      name: "Cuisine",
      points: [
        { x: 5, y: 3 },
        { x: 8, y: 3 },
        { x: 8, y: 6 },
        { x: 5, y: 6 },
      ],
      color: "#d9dcd2",
    },
  ];
  p.items = [
    { ...furniture(catalog[0]), x: 1.4, y: 1.1 },
    { ...furniture(catalog[2]), x: 1.4, y: 2.4 },
    { ...furniture(catalog[4]), x: 6.6, y: 1.6 },
    { ...furniture(catalog[8]), x: 6.6, y: 4.5 },
    { ...furniture(catalog[17]), x: 0.6, y: 5.4 },
  ];
  return p;
}
export function validateProject(v: unknown): asserts v is Project {
  const p = v as Project;
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const text = (s: unknown) => typeof s === "string" && s.length > 0;
  const color = (s: unknown) =>
    typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s);
  const point = (q: Point) => q && finite(q.x) && finite(q.y);
  if (
    !p ||
    p.version !== 1 ||
    !text(p.id) ||
    !text(p.name) ||
    !finite(p.updated) ||
    !Array.isArray(p.items) ||
    !Array.isArray(p.walls) ||
    !Array.isArray(p.rooms)
  )
    throw Error("Sauvegarde Roomora invalide.");
  const ids = new Set<string>();
  for (const object of [...p.items, ...p.walls, ...p.rooms]) {
    if (!object || !text(object.id) || ids.has(object.id))
      throw Error("Identifiant d’objet invalide ou dupliqué.");
    ids.add(object.id);
  }
  for (const i of p.items) {
    if (
      !text(i.name) ||
      !text(i.kind) ||
      !color(i.color) ||
      ![i.x, i.y, i.rotation, i.width, i.depth, i.height].every(finite) ||
      Math.min(i.width, i.depth, i.height) <= 0
    )
      throw Error("Dimensions de meuble invalides.");
    if (
      (i.asset !== undefined && !text(i.asset)) ||
      (i.photo !== undefined && !text(i.photo))
    )
      throw Error("Ressource de meuble invalide.");
    if (i.elevation !== undefined && (!finite(i.elevation) || i.elevation < 0))
      throw Error("Élévation invalide.");
    if (
      i.modelPart !== undefined &&
      (!i.asset ||
        !/^\d+(\/\d+)*$/.test(i.modelPart) ||
        i.modelPart.length > 500)
    )
      throw Error("Sous-objet de modèle invalide.");
    if (
      i.footprints !== undefined &&
      (!Array.isArray(i.footprints) ||
        i.footprints.length > 64 ||
        i.footprints.some(
          (f) =>
            ![f.x, f.y, f.width, f.depth, f.bottom, f.top].every(finite) ||
            Math.abs(f.x) > 1 ||
            Math.abs(f.y) > 1 ||
            f.width <= 0 ||
            f.width > 2 ||
            f.depth <= 0 ||
            f.depth > 2 ||
            f.bottom < 0 ||
            f.top > 1 ||
            f.bottom > f.top,
        ))
    )
      throw Error("Empreinte de modèle invalide.");
    if (i.url && !/^https?:\/\//i.test(i.url))
      throw Error("Lien produit invalide.");
  }
  for (const w of p.walls) {
    if (
      !point(w.a) ||
      !point(w.b) ||
      ![w.height, w.thickness].every(finite) ||
      distance(w.a, w.b) < 0.01 ||
      w.height <= 0 ||
      w.thickness <= 0 ||
      !color(w.color) ||
      !Array.isArray(w.openings)
    )
      throw Error("Mur invalide.");
    for (const o of w.openings)
      if (
        !o ||
        !text(o.id) ||
        !["door", "window"].includes(o.kind) ||
        ![o.offset, o.width, o.height, o.sill].every(finite) ||
        o.offset < 0 ||
        o.width <= 0 ||
        o.height <= 0 ||
        o.sill < 0
      )
        throw Error("Ouverture invalide.");
  }
  for (const r of p.rooms)
    if (
      !text(r.name) ||
      !color(r.color) ||
      (r.finish !== undefined &&
        !["plain", "oak", "walnut", "ash", "tile", "concrete"].includes(
          r.finish,
        )) ||
      !Array.isArray(r.points) ||
      r.points.length < 3 ||
      r.points.some((q) => !point(q))
    )
      throw Error("Pièce invalide.");
  if (
    p.plan &&
    (!text(p.plan.asset) ||
      ![p.plan.width, p.plan.height, p.plan.scale].every(finite) ||
      Math.min(p.plan.width, p.plan.height, p.plan.scale) <= 0)
  )
    throw Error("Échelle du plan invalide.");
}

/** Place a rectangular footprint flush against the closest finite wall. */
export function againstWall(item: Item, walls: Wall[]): Item {
  if (!walls.length) return item;
  const wall = [...walls].sort(
    (a, b) => segmentDistance(item, a.a, a.b) - segmentDistance(item, b.a, b.b),
  )[0];
  const len = distance(wall.a, wall.b),
    dx = (wall.b.x - wall.a.x) / len,
    dy = (wall.b.y - wall.a.y) / len;
  const t = Math.max(
    item.width / 2,
    Math.min(
      len - item.width / 2,
      (item.x - wall.a.x) * dx + (item.y - wall.a.y) * dy,
    ),
  );
  const side =
    (item.x - wall.a.x) * -dy + (item.y - wall.a.y) * dx >= 0 ? 1 : -1;
  const offset = (side * (wall.thickness + item.depth)) / 2;
  return {
    ...item,
    x: wall.a.x + dx * t - dy * offset,
    y: wall.a.y + dy * t + dx * offset,
    rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

/** Calibrate automatically reconstructed structure while keeping real furniture dimensions. */
export function calibrateAutomaticPlan(p: Project, factor: number) {
  if (!p.plan || !p.analysis || !Number.isFinite(factor) || factor <= 0)
    throw Error("Calibrage invalide.");
  p.plan.scale *= factor;
  const scale = (q: Point) => ({ x: q.x * factor, y: q.y * factor });
  for (const w of p.walls) {
    w.a = scale(w.a);
    w.b = scale(w.b);
    w.thickness *= factor;
    for (const o of w.openings) {
      o.offset *= factor;
      o.width *= factor;
    }
  }
  for (const r of p.rooms) r.points = r.points.map(scale);
  for (const i of p.items) {
    i.x *= factor;
    i.y *= factor;
  }
  p.analysis.warnings[0] =
    "Échelle recalibrée sur une distance connue. Les contours détectés restent à vérifier.";
}
