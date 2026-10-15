import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { floorFinishes, type FloorFinish } from "./floorFinishes";
/** Procedural surfaces, generated locally; UVs on the floor are measured in metres. */
export function surfaceTexture(kind: FloorFinish | "fabric") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  let seed = 37;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const base =
    kind === "fabric"
      ? "#dedbd3"
      : floorFinishes.find((f) => f.id === kind)?.color || "#c8a575";
  c.fillStyle = base;
  c.fillRect(0, 0, 512, 512);
  if (["oak", "walnut", "ash"].includes(kind)) {
    for (let row = 0; row < 8; row++)
      for (let x = -(row % 2) * 256; x < 512; x += 512) {
        c.fillStyle = `rgba(${random() > 0.5 ? "255,245,220" : "45,25,10"},${0.03 + random() * 0.09})`;
        c.fillRect(x, row * 64, 512, 64);
        c.strokeStyle = "rgba(55,35,15,.22)";
        c.lineWidth = 1;
        c.strokeRect(x, row * 64, 512, 64);
      }
    for (let i = 0; i < 2300; i++) {
      const x = random() * 512,
        y = random() * 512;
      c.strokeStyle = `rgba(${random() > 0.5 ? "255,240,210" : "50,32,12"},${random() * 0.13})`;
      c.lineWidth = 0.3 + random();
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(
        x + 30,
        y - 1,
        x + 70,
        y + 1,
        x + 100 + random() * 100,
        y,
      );
      c.stroke();
    }
  } else if (kind === "tile") {
    c.strokeStyle = "#a9a79f";
    c.lineWidth = 3;
    for (let i = 0; i <= 512; i += 256) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 512);
      c.moveTo(0, i);
      c.lineTo(512, i);
      c.stroke();
    }
  } else if (kind === "fabric") {
    for (let i = 0; i < 512; i += 3) {
      c.strokeStyle = i % 2 ? "#bebbb3" : "#eeeae2";
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 512);
      c.moveTo(0, i);
      c.lineTo(512, i);
      c.stroke();
    }
  }
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${random() * 0.045})`;
    c.fillRect(random() * 512, random() * 512, 1, 1);
  }
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.repeat.set(kind === "fabric" ? 3 : 0.5, kind === "fabric" ? 3 : 0.5);
  t.anisotropy = 4;
  return t;
}
