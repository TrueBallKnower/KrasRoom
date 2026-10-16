import type { Project } from "./model";
import { uid, validateProject } from "./model";
import { assetGet, assetPut, saveProject, projects } from "./db";
import { cloudClient } from "./cloudClient";
import {
  cloudLink,
  putCloudLink,
  cachedCloudAsset,
  cacheCloudAsset,
} from "./cloudMeta";
import {
  assetIds,
  sha256,
  fingerprint,
  validateCloudDocument,
  CLOUD_CHUNK_SIZE,
  CLOUD_JSON_LIMIT,
  type CloudAsset,
  type CloudRow,
  type CloudDocument,
} from "./cloudDocument";
import {
  checkSize,
  PROJECT_EXPANDED_LIMIT,
  PREPARED_MODEL_LIMIT,
} from "./importLimits";
export class CloudConflict extends Error {
  constructor() {
    super(
      "Une autre version existe en ligne. Ouvrez-la ou enregistrez votre travail dans une copie.",
    );
  }
}
const bucket = "roomora-private";
export async function listCloudProjects() {
  const c = await cloudClient();
  const { data, error } = await c
    .from("roomora_projects")
    .select("project_id,name,revision,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data as Omit<CloudRow, "document">[];
}
export async function saveCloudProject(
  p: Project,
  user: string,
  report: (s: string) => void = () => {},
) {
  validateProject(p);
  const c = await cloudClient();
  const link = await cloudLink(user, p.id);
  // Detect a stale device before uploading newly imported files.
  const { data: existing, error: readError } = await c
    .from("roomora_projects")
    .select("revision")
    .eq("project_id", p.id)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.revision !== link?.revision && existing)
    throw new CloudConflict();
  if (link && !existing) throw new CloudConflict();
  const assets: Record<string, CloudAsset> = Object.create(null);
  let total = 0;
  for (const id of assetIds(p)) {
    const blob = await assetGet(id);
    if (!blob) throw Error("Un fichier local du projet est introuvable.");
    total += blob.size;
    checkSize(total, PROJECT_EXPANDED_LIMIT, "Projet en ligne");
    checkSize(blob.size, PREPARED_MODEL_LIMIT, "Ressource");
    const cached = await cachedCloudAsset(user, id);
    if (cached && cached.size === blob.size) {
      assets[id] = cached;
      continue;
    }
    const parts: CloudAsset["parts"] = [];
    for (let offset = 0; offset < blob.size; offset += CLOUD_CHUNK_SIZE) {
      report(
        `Envoi des fichiers : ${(offset / 1024 / 1024).toFixed(0)} / ${(blob.size / 1024 / 1024).toFixed(0)} Mo`,
      );
      const part = blob.slice(
          offset,
          Math.min(blob.size, offset + CLOUD_CHUNK_SIZE),
          "application/octet-stream",
        ),
        hash = await sha256(await part.arrayBuffer()),
        path = `${user}/blobs/${hash}`;
      const { error } = await c.storage.from(bucket).upload(path, part, {
        upsert: false,
        contentType: "application/octet-stream",
      });
      if (
        error &&
        !["409", "Duplicate"].includes(
          String((error as { statusCode?: string }).statusCode),
        ) &&
        !/already exists|duplicate/i.test(error.message)
      )
        throw error;
      parts.push({ path, size: part.size, hash });
    }
    assets[id] = { size: blob.size, type: blob.type, parts };
    await cacheCloudAsset(user, id, assets[id]);
  }
  const document: CloudDocument = { version: 1, project: p, assets };
  validateCloudDocument(document, user, p.id);
  checkSize(
    new Blob([JSON.stringify(document)]).size,
    CLOUD_JSON_LIMIT,
    "Description du projet",
  );
  report("Enregistrement de l’appartement…");
  const revision = uid(),
    row = {
      owner_id: user,
      project_id: p.id,
      name: p.name,
      revision,
      document,
    };
  const result = existing
    ? await c
        .from("roomora_projects")
        .update(row)
        .eq("project_id", p.id)
        .eq("revision", link!.revision)
        .select("revision")
    : await c.from("roomora_projects").insert(row).select("revision");
  if (result.error) {
    if (result.error.code === "23505") throw new CloudConflict();
    throw result.error;
  }
  if (result.data?.length !== 1) throw new CloudConflict();
  await putCloudLink(user, p.id, {
    revision,
    fingerprint: await fingerprint(p),
  });
}
export async function openCloudProject(
  id: string,
  user: string,
  report: (s: string) => void = () => {},
  canApply: () => boolean = () => true,
) {
  const c = await cloudClient(),
    { data, error } = await c
      .from("roomora_projects")
      .select("*")
      .eq("project_id", id)
      .single();
  if (error) throw error;
  const row = data as CloudRow;
  validateCloudDocument(row.document, user, id);
  const project = structuredClone(row.document.project),
    remap = new Map<string, string>();
  for (const oldId of assetIds(project)) {
    const asset = row.document.assets[oldId],
      chunks: Blob[] = [];
    for (const part of asset.parts) {
      report("Récupération des meubles et des textures…");
      const { data: bytes, error } = await c.storage
        .from(bucket)
        .download(part.path);
      if (error) throw error;
      if (
        bytes.size !== part.size ||
        (await sha256(await bytes.arrayBuffer())) !== part.hash
      )
        throw Error(
          "Fichier reçu incomplet ou endommagé. Votre copie locale est conservée.",
        );
      chunks.push(bytes);
    }
    const blob = new Blob(chunks, { type: asset.type });
    const localId = await assetPut(blob);
    remap.set(oldId, localId);
    await cacheCloudAsset(user, localId, asset);
  }
  if (project.plan) project.plan.asset = remap.get(project.plan.asset)!;
  for (const i of project.items) {
    if (i.asset) i.asset = remap.get(i.asset)!;
    if (i.photo) i.photo = remap.get(i.photo)!;
  }
  if (!canApply())
    throw Error(
      "Vous avez modifié l’appartement pendant sa récupération. Votre travail local est conservé ; réessayez après la sauvegarde.",
    );
  // Never silently overwrite edits that only exist on this device.
  const local = (await projects()).find((p) => p.id === id),
    link = await cloudLink(user, id);
  if (local && (!link || (await fingerprint(local)) !== link.fingerprint))
    await saveProject({
      ...local,
      id: uid(),
      name: local.name + " (copie locale)",
    });
  await saveProject(project);
  await putCloudLink(user, id, {
    revision: row.revision,
    fingerprint: await fingerprint(project),
  });
  return project;
}
