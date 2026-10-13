import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { assetPut } from "./db";
import { uid, type Item } from "./model";
export async function parseModel(blob: Blob) {
  if (blob.size > 50 * 1024 * 1024)
    throw Error("Modèle trop volumineux : maximum 50 Mo.");
  const bytes = await blob.arrayBuffer();
  const head = new Uint8Array(bytes);
  let json;
  try {
    if (
      head[0] === 103 &&
      head[1] === 108 &&
      head[2] === 84 &&
      head[3] === 70
    ) {
      const view = new DataView(bytes);
      if (
        bytes.byteLength < 20 ||
        view.getUint32(4, true) !== 2 ||
        view.getUint32(8, true) !== bytes.byteLength ||
        view.getUint32(16, true) !== 0x4e4f534a
      )
        throw Error("En-tête GLB invalide.");
      const length = view.getUint32(12, true);
      if (length + 20 > bytes.byteLength) throw Error("GLB tronqué.");
      json = JSON.parse(
        new TextDecoder().decode(head.subarray(20, 20 + length)).trim(),
      );
    } else json = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw Error("Fichier GLB ou glTF invalide.");
  }
  if (json.asset?.version !== "2.0")
    throw Error("Seul glTF 2.0 est pris en charge.");
  for (const r of [...(json.buffers || []), ...(json.images || [])])
    if (r.uri && !r.uri.startsWith("data:"))
      throw Error(
        "Ce modèle utilise des fichiers externes. Exportez-le en GLB ou glTF avec ressources intégrées.",
      );
  if (
    (json.extensionsRequired || []).some((v: string) =>
      ["KHR_draco_mesh_compression", "KHR_texture_basisu"].includes(v),
    )
  )
    throw Error(
      "Compression Draco/KTX2 non prise en charge. Exportez un GLB sans cette compression.",
    );
  const { GLTFLoader } =
    await import("three/examples/jsm/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  return new Promise<GLTF>((resolve, reject) =>
    loader.parse(bytes, "", resolve, (e) =>
      reject(Error("Chargement du modèle impossible : " + String(e))),
    ),
  );
}
export async function importModel(blob: Blob, name: string): Promise<Item> {
  const gltf = await parseModel(blob);
  const { Box3, Vector3 } = await import("three");
  const box = new Box3().setFromObject(gltf.scene),
    size = box.getSize(new Vector3());
  if (!Number.isFinite(size.length()) || size.length() === 0)
    throw Error("Le modèle ne contient aucune géométrie visible.");
  return {
    id: uid(),
    name: name.replace(/\.(glb|gltf)$/i, ""),
    kind: "model",
    x: 3,
    y: 3,
    rotation: 0,
    width: Math.max(0.01, size.x),
    height: Math.max(0.01, size.y),
    depth: Math.max(0.01, size.z),
    color: "#c2ac95",
    asset: await assetPut(blob),
  };
}
export async function importURL(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:")
    throw Error("Utilisez une URL HTTPS directe vers un fichier GLB ou glTF.");
  if (!/\.(glb|gltf)$/i.test(url.pathname))
    throw Error(
      "Ce lien doit pointer vers un fichier .glb ou .gltf, et non vers une page produit.",
    );
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  } catch {
    throw Error(
      "Téléchargement impossible : le site doit autoriser CORS. Téléchargez le fichier puis importez-le localement.",
    );
  }
  if (!response.ok)
    throw Error("Téléchargement refusé (HTTP " + response.status + ").");
  if (Number(response.headers.get("content-length")) > 50 * 1024 * 1024)
    throw Error("Fichier trop volumineux.");
  return importModel(
    await response.blob(),
    decodeURIComponent(url.pathname.split("/").pop()!),
  );
}
export async function importPlan(file: File) {
  if (file.size > 30 * 1024 * 1024)
    throw Error("Plan trop volumineux (30 Mo maximum).");
  let blob: Blob = file;
  if (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  ) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    const page = await doc.getPage(1);
    const initial = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(2, 3000 / Math.max(initial.width, initial.height)),
    });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({
      canvas,
      canvasContext: canvas.getContext("2d")!,
      viewport,
    }).promise;
    blob = await new Promise<Blob>((r, j) =>
      canvas.toBlob(
        (b) => (b ? r(b) : j(Error("PDF illisible."))),
        "image/png",
      ),
    );
    await doc.destroy();
  } else if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error("Plan PDF, PNG ou JPG attendu.");
  const bitmap = await createImageBitmap(blob);
  const result = {
    asset: await assetPut(blob),
    width: bitmap.width,
    height: bitmap.height,
    scale: 8 / bitmap.width,
  };
  bitmap.close();
  return result;
}
