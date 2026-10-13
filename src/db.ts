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
  await (await db()).put("assets", blob, id);
  return id;
}
export async function assetGet(id: string): Promise<Blob | undefined> {
  return (await db()).get("assets", id);
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
  for (const id of ids) {
    const b = await assetGet(id);
    if (!b) throw Error("Ressource manquante : " + id);
    files["assets/" + id] = new Uint8Array(await b.arrayBuffer());
  }
  return new Blob([zipSync(files) as Uint8Array<ArrayBuffer>], {
    type: "application/zip",
  });
}
export async function importProject(blob: Blob) {
  if (blob.size > 200 * 1024 * 1024)
    throw Error("Archive trop volumineuse (200 Mo maximum).");
  let expanded = 0;
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()), {
    filter(file) {
      expanded += file.originalSize;
      if (expanded > 300 * 1024 * 1024)
        throw Error("Archive décompressée trop volumineuse (300 Mo maximum).");
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
      "La sauvegarde doit contenir un seul fichier project.json. Sélectionnez le ZIP Roomora.",
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
