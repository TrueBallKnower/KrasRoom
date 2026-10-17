import type { Object3D } from "three";
import { checkSize, PREPARED_MODEL_LIMIT } from "./importLimits";
export async function exportModelGLB(object: Object3D): Promise<Blob> {
  const { GLTFExporter } =
    await import("three/examples/jsm/exporters/GLTFExporter.js");
  object.updateMatrixWorld(true);
  const bytes = await new GLTFExporter().parseAsync(object, {
    binary: true,
    onlyVisible: true,
  });
  if (!(bytes instanceof ArrayBuffer)) throw Error("Export GLB impossible.");
  const blob = new Blob([bytes], { type: "model/gltf-binary" });
  checkSize(blob.size, PREPARED_MODEL_LIMIT, "Modèle exporté");
  return blob;
}
export function downloadModel(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[^\p{L}\p{N} _.-]/gu, "_") + ".glb";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
