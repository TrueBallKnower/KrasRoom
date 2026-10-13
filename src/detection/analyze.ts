import { assetGet } from "../db";
import { blank, uid, type Project } from "../model";
import { type Detection, type Options } from "./geometry";
export async function analyzePlan(
  plan: NonNullable<Project["plan"]>,
  options: Partial<Options> = {},
): Promise<Detection> {
  const blob = await assetGet(plan.asset);
  if (!blob) throw Error("Le plan importé est introuvable.");
  const image = await createImageBitmap(blob);
  const ratio = Math.min(1, 960 / Math.max(image.width, image.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * ratio);
  canvas.height = Math.round(image.height * ratio);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./detect.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    const timeout = setTimeout(() => {
      finish();
      reject(
        Error("Analyse trop longue. Essayez un plan plus simple ou recadré."),
      );
    }, 30000);
    worker.onmessage = (e) => {
      finish();
      e.data.ok ? resolve(e.data.result) : reject(Error(e.data.error));
    };
    worker.onerror = () => {
      finish();
      reject(Error("Le moteur de reconnaissance n’a pas pu démarrer."));
    };
    worker.postMessage(
      {
        pixels: data.buffer,
        width: canvas.width,
        height: canvas.height,
        options,
      },
      [data.buffer],
    );
  });
}
export function reconstruct(
  d: Detection,
  plan: NonNullable<Project["plan"]>,
  surface: number,
  name: string,
): Project {
  if (!Number.isFinite(surface) || surface < 1 || surface > 10000)
    throw Error("Indiquez une surface entre 1 et 10 000 m².");
  if (!d.rooms.length || d.pixelArea <= 0 || d.walls.length < 4)
    throw Error(
      "Je ne trouve pas de contour d’appartement suffisamment fermé. Essayez un plan net, recadré, avec des murs épais et horizontaux/verticaux. Aucun appartement fictif n’a été généré.",
    );
  const scale = Math.sqrt(surface / d.pixelArea),
    p = blank(name);
  p.plan = { ...plan, scale: (scale * d.width) / plan.width };
  p.walls = d.walls.map((w) => ({
    id: uid(),
    a:
      w.axis === "h"
        ? { x: w.start * scale, y: w.center * scale }
        : { x: w.center * scale, y: w.start * scale },
    b:
      w.axis === "h"
        ? { x: w.end * scale, y: w.center * scale }
        : { x: w.center * scale, y: w.end * scale },
    thickness: Math.max(0.04, w.thickness * scale),
    height: 2.6,
    color: "#e9e5de",
    detection: { confidence: 0.7, reviewed: false },
    openings: w.openings
      .filter((o) => o.offset >= 0 && o.offset + o.width <= w.end - w.start)
      .map((o) => ({
        id: uid(),
        kind: o.kind,
        offset: o.offset * scale,
        width: o.width * scale,
        height: o.kind === "door" ? 2.1 : 1.2,
        sill: o.kind === "door" ? 0 : 0.9,
        detection: { confidence: o.confidence, reviewed: false },
      })),
  }));
  p.rooms = d.rooms.map((points, i) => ({
    id: uid(),
    name: "Pièce " + (i + 1),
    points: points.map((q) => ({ x: q.x * scale, y: q.y * scale })),
    color: ["#ddcbb4", "#d5d0c3", "#d9dcd2"][i % 3],
  }));
  p.analysis = {
    surface,
    estimated: true,
    warnings: d.warnings,
    created: Date.now(),
  };
  return p;
}
