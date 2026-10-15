import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import worker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { prepareFurnitureFile, prepareFurnitureFolder } from "./modelBundle";
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
        "Ce glTF utilise des fichiers externes. Importez le ZIP complet du téléchargement avec ses textures, ou choisissez le format GLB.",
      );
  if ((json.extensionsRequired || []).includes("KHR_texture_basisu"))
    throw Error(
      "Textures KTX2 non prises en charge. Choisissez des textures PNG/JPG sur le site source.",
    );
  const { GLTFLoader } =
    await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { DRACOLoader } =
    await import("three/examples/jsm/loaders/DRACOLoader.js");
  const { MeshoptDecoder } =
    await import("three/examples/jsm/libs/meshopt_decoder.module.js");
  const draco = new DRACOLoader().setDecoderPath(
    import.meta.env.BASE_URL + "decoders/draco/",
  );
  const loader = new GLTFLoader()
    .setDRACOLoader(draco)
    .setMeshoptDecoder(MeshoptDecoder);
  return new Promise<GLTF>((resolve, reject) =>
    loader.parse(
      bytes,
      "",
      (g) => {
        draco.dispose();
        resolve(g);
      },
      (e) => {
        draco.dispose();
        reject(Error("Chargement du modèle impossible : " + String(e)));
      },
    ),
  );
}
export type ImportReport = (stage: string) => void;
async function prepareInWorker(input: File | File[]) {
  return new Promise<{ blob: Blob; name: string }>((resolve, reject) => {
    const worker = new Worker(new URL("./bundle.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.error) reject(Error(e.data.error));
      else resolve(e.data.result);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(
        Error(
          "Préparation du dossier impossible. Réessayez avec un fichier GLB.",
        ),
      );
    };
    worker.postMessage(input);
  });
}
export async function importFurnitureFiles(
  files: File[],
  report: ImportReport = () => {},
): Promise<Item> {
  report("Préparation du dossier et des textures…");
  const prepared = await prepareInWorker(files);
  return importModel(prepared.blob, prepared.name, report);
}
export async function importFurnitureFile(
  file: File,
  report: ImportReport = () => {},
): Promise<Item> {
  report(
    /\.zip$/i.test(file.name)
      ? "Décompression du ZIP et intégration des textures…"
      : "Lecture du fichier 3D…",
  );
  const prepared = /\.zip$/i.test(file.name)
    ? await prepareInWorker(file)
    : await prepareFurnitureFile(file);
  return importModel(prepared.blob, prepared.name, report);
}
export async function importModel(
  blob: Blob,
  name: string,
  report: ImportReport = () => {},
): Promise<Item> {
  report("Décodage du modèle 3D…");
  const gltf = await parseModel(blob);
  const { Box3, Vector3 } = await import("three");
  report("Calcul des dimensions et des empreintes…");
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const box = new Box3().setFromObject(gltf.scene),
    size = box.getSize(new Vector3());
  if (!Number.isFinite(size.length()) || size.length() === 0)
    throw Error("Le modèle ne contient aucune géométrie visible.");
  const { primeModel, modelFootprints } = await import("./modelAssets");
  report("Enregistrement du modèle et de ses textures…");
  const asset = await assetPut(blob);
  primeModel(asset, gltf, blob.size);
  return {
    id: uid(),
    footprints: modelFootprints(gltf.scene),
    name: name.replace(/\.(glb|gltf|zip)$/i, ""),
    kind: "model",
    x: 3,
    y: 3,
    rotation: 0,
    width: Math.max(0.01, size.x),
    height: Math.max(0.01, size.y),
    depth: Math.max(0.01, size.z),
    color: "#c2ac95",
    asset,
  };
}
export async function importURL(raw: string, report: ImportReport = () => {}) {
  report("Connexion au fichier distant…");
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
  let loaded = 0;
  const total = Number(response.headers.get("content-length")) || undefined;
  const reader = response.body?.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        if (loaded > 50 * 1024 * 1024)
          throw Error("Fichier trop volumineux (50 Mo maximum).");
        chunks.push(value as Uint8Array<ArrayBuffer>);
        report(
          `Téléchargement : ${(loaded / 1024 / 1024).toFixed(1)} Mo${total ? ` / ${(total / 1024 / 1024).toFixed(1)} Mo` : ""}`,
        );
      }
    } catch (e) {
      await reader.cancel();
      throw e;
    }
  }
  const blob = reader ? new Blob(chunks) : await response.blob();
  return importModel(
    blob,
    decodeURIComponent(url.pathname.split("/").pop()!),
    report,
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
