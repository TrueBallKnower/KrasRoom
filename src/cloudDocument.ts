import type { Project } from "./model";
import { validateProject } from "./model";
import {
  PREPARED_MODEL_LIMIT,
  PROJECT_EXPANDED_LIMIT,
  checkSize,
} from "./importLimits";
export const CLOUD_CHUNK_SIZE = 20 * 1024 * 1024;
export const CLOUD_JSON_LIMIT = 5 * 1024 * 1024;
export type CloudPart = { path: string; size: number; hash: string };
export type CloudAsset = { size: number; type: string; parts: CloudPart[] };
export type CloudDocument = {
  version: 1;
  project: Project;
  assets: Record<string, CloudAsset>;
};
export type CloudRow = {
  project_id: string;
  name: string;
  revision: string;
  updated_at: string;
  document: CloudDocument;
};
export function assetIds(p: Project) {
  return [
    ...new Set(
      [p.plan?.asset, ...p.items.flatMap((i) => [i.asset, i.photo])].filter(
        Boolean,
      ) as string[],
    ),
  ];
}
export async function sha256(data: BufferSource) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function fingerprint(p: Project) {
  return sha256(new TextEncoder().encode(JSON.stringify(p)));
}
export function validateCloudDocument(
  value: unknown,
  owner: string,
  projectId: string,
): asserts value is CloudDocument {
  const d = value as CloudDocument;
  if (
    !d ||
    d.version !== 1 ||
    !d.project ||
    !d.assets ||
    typeof d.assets !== "object"
  )
    throw Error("Sauvegarde en ligne invalide.");
  validateProject(d.project);
  if (d.project.id !== projectId)
    throw Error("Identifiant de projet incohérent.");
  checkSize(
    new Blob([JSON.stringify(d)]).size,
    CLOUD_JSON_LIMIT,
    "Description du projet",
  );
  let total = 0;
  for (const id of assetIds(d.project)) {
    const a = d.assets[id];
    if (
      !a ||
      !Number.isSafeInteger(a.size) ||
      a.size <= 0 ||
      a.size > PREPARED_MODEL_LIMIT ||
      typeof a.type !== "string" ||
      a.type.length > 200 ||
      !Array.isArray(a.parts) ||
      !a.parts.length ||
      a.parts.length > 8
    )
      throw Error("Ressource en ligne invalide.");
    let size = 0;
    for (const p of a.parts) {
      if (
        !p ||
        !/^[a-f0-9]{64}$/.test(p.hash) ||
        p.path !== `${owner}/blobs/${p.hash}` ||
        !Number.isSafeInteger(p.size) ||
        p.size <= 0 ||
        p.size > CLOUD_CHUNK_SIZE
      )
        throw Error("Fragment de sauvegarde invalide.");
      size += p.size;
    }
    if (size !== a.size) throw Error("Ressource en ligne incomplète.");
    total += size;
  }
  checkSize(total, PROJECT_EXPANDED_LIMIT, "Projet en ligne");
}
