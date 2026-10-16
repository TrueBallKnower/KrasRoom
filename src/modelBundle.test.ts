import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  embedGLTF,
  prepareFurnitureFile,
  prepareFurnitureFolder,
} from "./modelBundle";
const model = {
  asset: { version: "2.0" },
  buffers: [{ uri: "mesh.bin", byteLength: 3 }],
  images: [{ uri: "textures/fabric%20blue.png" }],
};
const files = {
  "chair/scene.gltf": strToU8(JSON.stringify(model)),
  "chair/mesh.bin": new Uint8Array([1, 2, 3]),
  "chair/textures/fabric blue.png": new Uint8Array([4, 5, 6]),
};
describe("Meubles ZIP portables", () => {
  it("intègre les octets du modèle et des textures sans ressource externe", async () => {
    const result = JSON.parse(
      await embedGLTF(files, "chair/scene.gltf").text(),
    );
    expect(result.buffers[0].uri).toBe(
      "data:application/octet-stream;base64,AQID",
    );
    expect(result.images[0].uri).toBe("data:image/png;base64,BAUG");
  });
  it("prépare un ZIP téléchargé sans le décompresser manuellement", async () => {
    const f = new File(
      [zipSync(files) as Uint8Array<ArrayBuffer>],
      "chaise.zip",
    );
    const result = await prepareFurnitureFile(f);
    expect(result.name).toBe("chaise");
    expect(await result.blob.text()).toContain("data:image/png");
  });
  it("accepte aussi un dossier glTF décompressé", async () => {
    const input = Object.entries(files).map(([path, bytes]) => {
      const f = new File(
        [bytes as Uint8Array<ArrayBuffer>],
        path.split("/").pop()!,
      );
      Object.defineProperty(f, "webkitRelativePath", { value: path });
      return f;
    });
    const result = await prepareFurnitureFolder(input);
    expect(result.name).toBe("scene.gltf");
    expect(await result.blob.text()).toContain("data:image/png");
  });
  it("explique les textures absentes et refuse les téléchargements externes", () => {
    expect(() =>
      embedGLTF(
        { "chair/scene.gltf": files["chair/scene.gltf"] },
        "chair/scene.gltf",
      ),
    ).toThrow("Ressource manquante");
    expect(() =>
      embedGLTF(
        {
          "scene.gltf": strToU8(
            JSON.stringify({
              ...model,
              buffers: [{ uri: "https://example.com/mesh.bin" }],
            }),
          ),
        },
        "scene.gltf",
      ),
    ).toThrow("Internet");
  });
  it("distingue une sauvegarde KrasRoom et un ZIP ambigu", async () => {
    await expect(
      prepareFurnitureFile(
        new File(
          [
            zipSync({
              "project.json": strToU8("{}"),
            }) as Uint8Array<ArrayBuffer>,
          ],
          "backup.zip",
        ),
      ),
    ).rejects.toThrow("sauvegarde KrasRoom");
    await expect(
      prepareFurnitureFile(
        new File(
          [
            zipSync({
              "one.glb": new Uint8Array(),
              "two.glb": new Uint8Array(),
            }) as Uint8Array<ArrayBuffer>,
          ],
          "models.zip",
        ),
      ),
    ).rejects.toThrow("plusieurs modèles");
  });
});
