import { unzipSync, strFromU8 } from "fflate";
const MAX = 100 * 1024 * 1024;
const mime = (path: string) =>
  /\.png$/i.test(path)
    ? "image/png"
    : /\.jpe?g$/i.test(path)
      ? "image/jpeg"
      : /\.webp$/i.test(path)
        ? "image/webp"
        : "application/octet-stream";
function dataURI(bytes: Uint8Array, type: string) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768)
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:${type};base64,${btoa(binary)}`;
}
export function embedGLTF(
  files: Record<string, Uint8Array>,
  modelPath: string,
): Blob {
  const json = JSON.parse(strFromU8(files[modelPath]));
  const base = modelPath.split("/").slice(0, -1);
  for (const resource of [...(json.buffers || []), ...(json.images || [])]) {
    if (!resource.uri || resource.uri.startsWith("data:")) continue;
    if (/^[a-z]+:|^\/\//i.test(resource.uri))
      throw Error(
        "Le modèle référence une ressource Internet. Téléchargez une archive contenant toutes les textures.",
      );
    const path = [...base];
    let uri: string;
    try {
      uri = decodeURIComponent(resource.uri);
    } catch {
      throw Error("Nom de texture invalide.");
    }
    for (const part of uri.replace(/\\/g, "/").split("/")) {
      if (part === "..") {
        if (!path.length) throw Error("Chemin de ressource invalide.");
        path.pop();
      } else if (part && part !== ".") path.push(part);
    }
    const key = path.join("/"),
      bytes = files[key];
    if (!bytes)
      throw Error(
        `Ressource manquante : ${key}. Importez le ZIP complet du modèle, avec son dossier de textures.`,
      );
    resource.uri = dataURI(bytes, resource.mimeType || mime(key));
  }
  const blob = new Blob([JSON.stringify(json)], { type: "model/gltf+json" });
  if (blob.size > 50 * 1024 * 1024)
    throw Error(
      "Modèle avec textures trop volumineux (50 Mo maximum après préparation). Choisissez des textures moins grandes.",
    );
  return blob;
}
export async function prepareFurnitureFile(
  file: File,
): Promise<{ blob: Blob; name: string }> {
  if (file.size > 50 * 1024 * 1024)
    throw Error("Fichier trop volumineux (50 Mo maximum).");
  if (!/\.zip$/i.test(file.name)) return { blob: file, name: file.name };
  let expanded = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(f) {
      expanded += f.originalSize;
      if (expanded > MAX)
        throw Error("Archive décompressée trop volumineuse (100 Mo maximum).");
      return !f.name.startsWith("__MACOSX/") && !f.name.endsWith("/");
    },
  });
  if (Object.keys(files).some((p) => /(^|\/)project\.json$/.test(p)))
    throw Error(
      "Ceci est une sauvegarde Roomora. Utilisez le menu du projet → Restaurer une sauvegarde ZIP.",
    );
  const paths = Object.keys(files).filter((p) => /\.(glb|gltf)$/i.test(p));
  if (paths.length !== 1)
    throw Error(
      paths.length
        ? "Cette archive contient plusieurs modèles. Importez une archive contenant un seul meuble."
        : "Aucun modèle GLB ou glTF trouvé dans ce ZIP. Sur le site source, choisissez le téléchargement glTF ou GLB.",
    );
  const path = paths[0];
  return {
    blob: /\.glb$/i.test(path)
      ? new Blob([files[path] as Uint8Array<ArrayBuffer>], {
          type: "model/gltf-binary",
        })
      : embedGLTF(files, path),
    name: file.name.replace(/\.zip$/i, ""),
  };
}
export async function prepareFurnitureFolder(input: File[]) {
  if (input.reduce((n, f) => n + f.size, 0) > 50 * 1024 * 1024)
    throw Error("Dossier trop volumineux (50 Mo maximum).");
  const files: Record<string, Uint8Array> = {};
  for (const f of input)
    files[f.webkitRelativePath || f.name] = new Uint8Array(
      await f.arrayBuffer(),
    );
  const paths = Object.keys(files).filter((p) => /\.(gltf|glb)$/i.test(p));
  if (paths.length !== 1)
    throw Error(
      "Sélectionnez le dossier complet contenant un seul meuble GLB ou glTF et ses textures.",
    );
  const path = paths[0];
  return {
    blob: /\.glb$/i.test(path)
      ? new Blob([files[path] as Uint8Array<ArrayBuffer>])
      : embedGLTF(files, path),
    name: path.split("/").pop()!,
  };
}
