import {
  checkSize,
  PROJECT_ARCHIVE_LIMIT,
  PROJECT_EXPANDED_LIMIT,
} from "./importLimits";
import { openDB } from "idb";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { validateProject, type Project, type Item } from "./model";
const db = () =>
  openDB("roomora", 1, {
    upgrade(d) {
      d.createObjectStore("projects", { keyPath: "id" });
      d.createObjectStore("assets");
      d.createObjectStore("library", { keyPath: "id" });
    },
  });
export async function saveProject(p: Project) {
  await (await db()).put("projects", p);
}
export async function projects(): Promise<Project[]> {
  return (await db()).getAll("projects");
}
export async function removeProject(id: string) {
  await (await db()).delete("projects", id);
}
export async function assetPut(blob: Blob, id = crypto.randomUUID()) {
  const d = await db(),
    generation = crypto.randomUUID();
  let written = 0;
  try {
    const previous = (await d.get("assets", id)) as
      Blob | BinaryAsset | undefined;
    // WebKit can reject file-backed Blobs received from fetch/Blob.slice.
    // Convert outside each transaction, then persist small, plain byte buffers.
    for (let offset = 0; offset < blob.size; offset += LOCAL_CHUNK_SIZE) {
      const bytes = await blob
        .slice(offset, offset + LOCAL_CHUNK_SIZE)
        .arrayBuffer();
      await d.put("assets", bytes, partKey(id, generation, written));
      written++;
    }
    const tx = d.transaction("assets", "readwrite");
    const requests: Promise<unknown>[] = [
      tx.store.put(
        {
          format: "krasroom-bytes-v1",
          generation,
          size: blob.size,
          type: blob.type,
          parts: written,
        } satisfies BinaryAsset,
        id,
      ),
    ];
    if (isBinaryAsset(previous))
      for (let part = 0; part < previous.parts; part++)
        requests.push(tx.store.delete(partKey(id, previous.generation, part)));
    await Promise.all([...requests, tx.done]);
    return id;
  } catch (error) {
    // The old manifest stays usable until all new buffers have been written.
    for (let part = 0; part < written; part++)
      await d.delete("assets", partKey(id, generation, part)).catch(() => {});
    if ((error as { name?: string })?.name === "QuotaExceededError")
      throw Error(
        "Le stockage local de cet appareil est plein. Libérez de l’espace puis réessayez. Les données déjà enregistrées sont conservées.",
      );
    throw error;
  } finally {
    d.close();
  }
}
export async function assetGet(id: string): Promise<Blob | undefined> {
  const d = await db();
  try {
    const tx = d.transaction("assets", "readonly");
    const value = (await tx.store.get(id)) as Blob | BinaryAsset | undefined;
    // Existing desktop assets remain readable without migrating the database.
    if (value === undefined || value instanceof Blob) return value;
    if (!isBinaryAsset(value))
      throw Error(
        "Ressource locale invalide. Rouvrez la sauvegarde en ligne pour la récupérer.",
      );
    const requests = Array.from(
      { length: value.parts },
      (_, part) =>
        tx.store.get(partKey(id, value.generation, part)) as Promise<
          ArrayBuffer | undefined
        >,
    );
    const [buffers] = await Promise.all([Promise.all(requests), tx.done]);
    if (
      buffers.some(
        (bytes, part) =>
          !(bytes instanceof ArrayBuffer) ||
          bytes.byteLength !==
            Math.min(LOCAL_CHUNK_SIZE, value.size - part * LOCAL_CHUNK_SIZE),
      )
    )
      throw Error(
        "Fichier local incomplet. Rouvrez la sauvegarde en ligne pour le récupérer.",
      );
    return new Blob(buffers as ArrayBuffer[], { type: value.type });
  } finally {
    d.close();
  }
}
export const LOCAL_CHUNK_SIZE = 4 * 1024 * 1024;
type BinaryAsset = {
  format: "krasroom-bytes-v1";
  generation: string;
  size: number;
  type: string;
  parts: number;
};
function isBinaryAsset(value: unknown): value is BinaryAsset {
  const v = value as BinaryAsset | undefined;
  return (
    v?.format === "krasroom-bytes-v1" &&
    typeof v.generation === "string" &&
    Number.isSafeInteger(v.size) &&
    v.size >= 0 &&
    typeof v.type === "string" &&
    v.parts === Math.ceil(v.size / LOCAL_CHUNK_SIZE)
  );
}
function partKey(id: string, generation: string, part: number) {
  return ["binary-part", id, generation, part];
}
export async function library(): Promise<Item[]> {
  return (await db()).getAll("library");
}
export async function libraryPut(i: Item) {
  await (await db()).put("library", i);
}
export async function libraryDelete(id: string) {
  await (await db()).delete("library", id);
}
export async function exportProject(p: Project) {
  const files: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify(p)),
  };
  const ids = new Set(
    [p.plan?.asset, ...p.items.flatMap((i) => [i.asset, i.photo])].filter(
      Boolean,
    ) as string[],
  );
  let expanded = files["project.json"].byteLength;
  for (const id of ids) {
    const b = await assetGet(id);
    if (!b) throw Error("Ressource manquante : " + id);
    expanded += b.size;
    checkSize(expanded, PROJECT_EXPANDED_LIMIT, "Projet à exporter");
    files["assets/" + id] = new Uint8Array(await b.arrayBuffer());
  }
  const archive = new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
  checkSize(archive.size, PROJECT_ARCHIVE_LIMIT, "Sauvegarde à exporter");
  return archive;
}
export async function importProject(blob: Blob) {
  checkSize(blob.size, PROJECT_ARCHIVE_LIMIT, "Archive");
  let expanded = 0;
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
    filter(file) {
      expanded += file.originalSize;
      checkSize(expanded, PROJECT_EXPANDED_LIMIT, "Archive décompressée");
      return (
        !file.name.startsWith("__MACOSX/") &&
        (file.name === "project.json" ||
          file.name.endsWith("/project.json") ||
          file.name.startsWith("assets/") ||
          file.name.includes("/assets/"))
      );
    },
  });
  const candidates = Object.keys(files).filter(
    (name) => name === "project.json" || name.endsWith("/project.json"),
  );
  if (candidates.length !== 1)
    throw Error(
      "La sauvegarde doit contenir un seul fichier project.json. Sélectionnez le ZIP KrasRoom.",
    );
  const projectPath = candidates[0];
  const prefix = projectPath.slice(0, -"project.json".length);
  const p = JSON.parse(strFromU8(files[projectPath]));
  validateProject(p);
  const ids = new Set(
    [p.plan?.asset, ...p.items.flatMap((i: Item) => [i.asset, i.photo])].filter(
      Boolean,
    ) as string[],
  );
  for (const id of ids)
    if (!files[prefix + "assets/" + id])
      throw Error("Ressource absente de la sauvegarde.");
  const remap = new Map<string, string>();
  for (const id of ids)
    remap.set(
      id,
      await assetPut(
        new Blob([files[prefix + "assets/" + id] as Uint8Array<ArrayBuffer>]),
      ),
    );
  if (p.plan) p.plan.asset = remap.get(p.plan.asset)!;
  for (const i of p.items) {
    if (i.asset) i.asset = remap.get(i.asset);
    if (i.photo) i.photo = remap.get(i.photo);
  }
  p.id = crypto.randomUUID();
  p.name += " (importé)";
  await saveProject(p);
  return p as Project;
}
