import { area, distance, type Project, type Wall } from "./model";
import { wallOutline } from "./spatial";
// Union of clipped opening rectangles: overlapping openings count only once.
export function openingArea(w: Wall): number {
  const length = distance(w.a, w.b);
  const rects = w.openings
    .map((o) => ({
      x0: Math.max(0, o.offset),
      x1: Math.min(length, o.offset + o.width),
      y0: Math.max(0, o.sill),
      y1: Math.min(w.height, o.sill + o.height),
    }))
    .filter((r) => r.x1 > r.x0 && r.y1 > r.y0);
  const xs = [...new Set(rects.flatMap((r) => [r.x0, r.x1]))].sort(
    (a, b) => a - b,
  );
  let total = 0;
  for (let i = 1; i < xs.length; i++) {
    const x = (xs[i - 1] + xs[i]) / 2;
    const ys = rects
      .filter((r) => r.x0 < x && r.x1 > x)
      .map((r) => [r.y0, r.y1])
      .sort((a, b) => a[0] - b[0]);
    let end = -Infinity,
      covered = 0;
    for (const [a, b] of ys) {
      covered += Math.max(0, b - Math.max(a, end));
      end = Math.max(end, b);
    }
    total += (xs[i] - xs[i - 1]) * covered;
  }
  return total;
}
export function quantities(p: Project) {
  const length = p.walls.reduce((n, w) => n + distance(w.a, w.b), 0);
  const face = p.walls.reduce(
    (n, w) => n + Math.max(0, distance(w.a, w.b) * w.height - openingArea(w)),
    0,
  );
  return {
    floor: p.rooms.reduce((n, r) => n + area(r.points), 0),
    length,
    wallFaces: face * 2,
    volume: p.walls.reduce(
      (n, w) =>
        n +
        Math.max(0, distance(w.a, w.b) * w.height - openingArea(w)) *
          w.thickness,
      0,
    ),
    openings: p.walls.reduce((n, w) => n + w.openings.length, 0),
  };
}
const xml = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function technicalSvg(p: Project, scale: 50 | 100 | 200): string {
  const points = [
    ...p.walls.flatMap((w) => [w.a, w.b]),
    ...p.rooms.flatMap((r) => r.points),
  ];
  if (!points.length)
    throw Error("Ajoutez des murs ou une pièce avant d’exporter un plan.");
  const margin = scale / 100,
    minX = Math.min(...points.map((v) => v.x)) - margin,
    minY = Math.min(...points.map((v) => v.y)) - margin;
  const width = Math.max(...points.map((v) => v.x)) - minX + margin,
    height = Math.max(...points.map((v) => v.y)) - minY + margin * 3;
  const font = (0.12 * scale) / 50;
  const text = (x: number, y: number, s: string) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${font}" fill="#152033" stroke="white" stroke-width="${font * 0.22}" paint-order="stroke">${xml(s)}</text>`;
  const floors = p.rooms
    .map(
      (r) =>
        `<polygon points="${r.points.map((v) => `${v.x},${v.y}`).join(" ")}" fill="#f4f4f4" stroke="#bbb" stroke-width=".01"/>${text(r.points.reduce((n, v) => n + v.x, 0) / r.points.length, r.points.reduce((n, v) => n + v.y, 0) / r.points.length, `${r.name} · ${area(r.points).toFixed(2)} m²`)}`,
    )
    .join("");
  const walls = p.walls
    .map((w) => {
      const len = distance(w.a, w.b),
        dx = (w.b.x - w.a.x) / len,
        dy = (w.b.y - w.a.y) / len;
      const gaps = w.openings
        .map((o) => {
          const a = Math.min(len, o.offset),
            b = Math.min(len, o.offset + o.width);
          return `<line x1="${w.a.x + dx * a}" y1="${w.a.y + dy * a}" x2="${w.a.x + dx * b}" y2="${w.a.y + dy * b}" stroke="${o.kind === "window" ? "#93c3e1" : "white"}" stroke-width="${w.thickness + 0.008}"/>`;
        })
        .join("");
      return `<polygon points="${wallOutline(w, p.walls)
        .map((v) => `${v.x},${v.y}`)
        .join(
          " ",
        )}" fill="#343b47"/>${gaps}${text((w.a.x + w.b.x) / 2 - dy * 0.22, (w.a.y + w.b.y) / 2 + dx * 0.22, `${len.toFixed(2)} m`)}`;
    })
    .join("");
  const legend = `${p.name} — 1:${scale} — unités : mètres — surface tracée : ${quantities(p).floor.toFixed(2)} m²`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(width * 1000) / scale}mm" height="${(height * 1000) / scale}mm" viewBox="${minX} ${minY} ${width} ${height}"><title>${xml(p.name)}</title><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="white"/><g font-family="Arial,sans-serif">${floors}${walls}${text(minX + width / 2, minY + height - margin, legend)}</g></svg>`;
}
function csvCell(s: string) {
  return '"' + (/^[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
}
export function quantityCsv(p: Project): string {
  const q = quantities(p);
  const rows = [
    ["Élément", "Valeur", "Unité"],
    ["Surface tracée", q.floor.toFixed(3), "m²"],
    ["Longueur des murs (axes)", q.length.toFixed(3), "m"],
    ["Faces de murs nettes (deux côtés)", q.wallFaces.toFixed(3), "m²"],
    ["Volume de murs net", q.volume.toFixed(3), "m³"],
    ["Ouvertures", String(q.openings), "unité"],
    ...p.rooms.map((r) => [r.name, area(r.points).toFixed(3), "m²"]),
  ];
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
