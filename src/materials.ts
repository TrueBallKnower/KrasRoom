import { useMemo, useEffect } from "react";
import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  NoColorSpace,
} from "three";
import {
  finishDefinition,
  type FloorFinish,
  type WallFinish,
} from "./floorFinishes";
type Kind = FloorFinish | WallFinish | "fabric";
/** Tileable, deterministic local textures. UV coordinates use metres. */
export function surfaceTexture(
  kind: Kind,
  channel: "color" | "height" | "roughness" = "color",
) {
  const definition = finishDefinition(kind),
    pattern = definition.pattern;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  let seed = 37;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const height = channel === "height",
    rough = channel === "roughness",
    mono = height || rough;
  c.fillStyle = mono ? (rough ? "#dedede" : "#c0c0c0") : definition.color;
  c.fillRect(0, 0, 512, 512);
  function line(x: number, y: number, xx: number, yy: number, width = 1) {
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(xx, yy);
    c.stroke();
  }
  if (["wood", "panel", "herringbone"].includes(pattern)) {
    if (pattern === "herringbone") {
      // Interlocking 4:1 rectangular blocks, with repeat-safe wrapping.
      const u = 32;
      for (let x = -20; x < 20; x++)
        for (let y = -20; y < 20; y++)
          if ((((x + y) % 8) + 8) % 8 === 0) {
            for (const [a, b, w, h] of [
              [x * u, y * u, 4 * u, u],
              [(x + 4) * u, y * u, u, 4 * u],
            ]) {
              c.fillStyle = mono
                ? `rgb(${170 + Math.floor(random() * 40)},${180},${180})`
                : `rgba(${random() > 0.5 ? "255,235,200" : "50,25,10"},.12)`;
              c.fillRect(a, b, w, h);
              c.strokeStyle = mono ? "#555" : "rgba(48,29,14,.35)";
              c.lineWidth = 1.5;
              c.strokeRect(a, b, w, h);
              c.strokeStyle = mono ? "#aaa" : "rgba(60,35,15,.13)";
              for (let j = 1; j < 7; j++)
                if (w > h) line(a, b + j * 4, a + w, b + j * 4, 0.7);
                else line(a + j * 4, b, a + j * 4, b + h, 0.7);
            }
          }
    } else {
      for (let row = 0; row < 8; row++)
        for (let x = -(row % 2) * 256; x < 512; x += 512) {
          c.fillStyle = `rgba(${random() > 0.5 ? "255,245,220" : "45,25,10"},${0.03 + random() * 0.09})`;
          c.fillRect(x, row * 64, 512, 64);
          c.strokeStyle = mono ? "#555" : "rgba(55,35,15,.28)";
          c.lineWidth = 1.5;
          c.strokeRect(x, row * 64, 512, 64);
        }
    }
    for (let i = 0; i < (pattern === "herringbone" ? 0 : 2000); i++) {
      const x = random() * 512,
        y = random() * 512;
      c.strokeStyle = `rgba(${random() > 0.5 ? "255,240,210" : "50,32,12"},${random() * 0.12})`;
      line(x, y, x + 30 + random() * 120, y + (random() - 0.5) * 2, 0.5);
    }
  } else if (["tile", "slate", "brick"].includes(pattern)) {
    const rows = pattern === "brick" ? 8 : 2,
      step = 512 / rows;
    for (let row = 0; row < rows; row++)
      for (
        let x = pattern === "brick" && row % 2 ? -128 : 0;
        x < 512;
        x += 256
      ) {
        c.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${0.02 + random() * 0.07})`;
        c.fillRect(x, row * step, 256, step);
        c.strokeStyle = mono
          ? "#444"
          : pattern === "brick"
            ? "#bdb3a4"
            : "#a7a399";
        c.lineWidth = pattern === "brick" ? 5 : 2;
        c.strokeRect(x, row * step, 256, step);
      }
  } else if (pattern === "marble") {
    for (let i = 0; i < 12; i++) {
      const y = random() * 512;
      c.strokeStyle = mono
        ? "rgba(70,70,70,.05)"
        : `rgba(${definition.color === "#292d30" ? "230,226,214" : "102,106,105"},${0.08 + random() * 0.2})`;
      c.lineWidth = 0.5 + random() * 2;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(
        170,
        y + random() * 150 - 75,
        350,
        y + random() * 150 - 75,
        512,
        y,
      );
      c.stroke();
    }
  } else if (pattern === "terrazzo") {
    const colors = ["#756d64", "#f3eee2", "#a69485", "#b7836b", "#4d5d59"];
    for (let i = 0; i < 1100; i++) {
      const x = random() * 512,
        y = random() * 512,
        r = 1 + random() * 5;
      c.fillStyle = mono
        ? "#bcbcbc"
        : colors[Math.floor(random() * colors.length)];
      c.beginPath();
      c.moveTo(x - r, y);
      c.lineTo(x, y - r);
      c.lineTo(x + r, y + r * 0.3);
      c.lineTo(x - r * 0.3, y + r);
      c.closePath();
      c.fill();
    }
  } else if (pattern === "fabric") {
    for (let i = 0; i < 512; i += 3) {
      c.strokeStyle = i % 2 ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.22)";
      line(i, 0, i, 512, 0.6);
      line(0, i, 512, i, 0.6);
    }
  } else if (pattern === "concrete" || pattern === "plaster") {
    for (let i = 0; i < 180; i++) {
      const x = random() * 512,
        y = random() * 512,
        r = 10 + random() * 60;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(
        0,
        `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${pattern === "plaster" ? 0.025 : 0.04})`,
      );
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 10000; i++) {
    c.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${random() * (height ? 0.14 : 0.045)})`;
    c.fillRect(random() * 512, random() * 512, 1, 1);
  }
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = channel === "color" ? SRGBColorSpace : NoColorSpace;
  t.repeat.set(1 / definition.size, 1 / definition.size);
  t.anisotropy = 8;
  return t;
}
export function surfaceMaps(kind: Kind, scale = 1, angle = 0) {
  const map = surfaceTexture(kind),
    bumpMap = surfaceTexture(kind, "height"),
    roughnessMap = surfaceTexture(kind, "roughness");
  for (const t of [map, bumpMap, roughnessMap]) {
    t.repeat.multiplyScalar(1 / scale);
    t.rotation = (angle * Math.PI) / 180;
  }
  return {
    map,
    bumpMap,
    roughnessMap,
    dispose() {
      map.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
    },
  };
}

// Identical surfaces share GPU textures. Keep a small warm cache for undo/redo.
type SurfaceEntry = {
  maps: ReturnType<typeof surfaceMaps>;
  refs: number;
  used: number;
};
const surfaceCache = new Map<string, SurfaceEntry>();
function trimSurfaceCache() {
  const unused = [...surfaceCache.entries()]
    .filter(([, e]) => e.refs === 0)
    .sort((a, b) => a[1].used - b[1].used);
  while (unused.length > 4) {
    const [key, e] = unused.shift()!;
    surfaceCache.delete(key);
    e.maps.dispose();
  }
}
export function useSurfaceMaps(
  kind: Kind,
  scale = 1,
  angle = 0,
  enabled = true,
) {
  const entry = useMemo(() => {
    if (!enabled) return null;
    const key = `${kind}:${scale}:${angle}`;
    let e = surfaceCache.get(key);
    if (!e) {
      e = { maps: surfaceMaps(kind, scale, angle), refs: 0, used: Date.now() };
      surfaceCache.set(key, e);
    }
    return e;
  }, [kind, scale, angle, enabled]);
  useEffect(() => {
    if (!entry) return;
    entry.refs++;
    entry.used = Date.now();
    return () => {
      entry.refs--;
      entry.used = Date.now();
      queueMicrotask(trimSurfaceCache);
    };
  }, [entry]);
  return entry?.maps || null;
}
