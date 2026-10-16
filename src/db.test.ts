import "fake-indexeddb/auto";
import { zipSync, unzipSync } from "fflate";
import { describe, it, expect, vi } from "vitest";
import { openDB } from "idb";
import { demo } from "./model";
import {
  saveProject,
  projects,
  removeProject,
  assetPut,
  assetGet,
  LOCAL_CHUNK_SIZE,
  exportProject,
  importProject,
  libraryPut,
  library,
  libraryDelete,
} from "./db";
describe("Persistance et sauvegardes portables", () => {
  it("enregistre, recharge et supprime un projet", async () => {
    const p = demo();
    await saveProject(p);
    expect((await projects()).find((v) => v.id === p.id)).toEqual(p);
    await removeProject(p.id);
    expect((await projects()).some((v) => v.id === p.id)).toBe(false);
  });
  it("exporte et restaure les octets réels des modèles, photos et plans", async () => {
    const p = demo();
    const id = await assetPut(new Blob(["ressource 3D exacte"]));
    p.items[0].asset = id;
    p.items[0].photo = id;
    p.plan = { asset: id, width: 100, height: 100, scale: 0.02 };
    const zip = await exportProject(p);
    const restored = await importProject(zip);
    expect(restored.id).not.toBe(p.id);
    expect(restored.items[0].asset).not.toBe(id);
    expect(await (await assetGet(restored.items[0].asset!))!.text()).toBe(
      "ressource 3D exacte",
    );
    expect(restored.plan!.asset).toBe(restored.items[0].asset);
  });
  it("conserve matériaux, teintes, plafonds et motifs dans IndexedDB et le ZIP", async () => {
    const p = demo();
    Object.assign(p.walls[0], {
      finish: "brick",
      color: "#a4b09a",
      textureScale: 1.5,
      textureAngle: 90,
    });
    Object.assign(p.rooms[0], {
      finish: "herringbone",
      tint: "#eee5da",
      ceilingColor: "#f5f3ed",
      textureScale: 0.75,
      textureAngle: 45,
    });
    await saveProject(p);
    const local = (await projects()).find((v) => v.id === p.id)!;
    expect(local.walls[0]).toEqual(p.walls[0]);
    expect(local.rooms[0]).toEqual(p.rooms[0]);
    const restored = await importProject(await exportProject(p));
    expect(restored.walls[0]).toEqual(p.walls[0]);
    expect(restored.rooms[0]).toEqual(p.rooms[0]);
  });
  it("restaure un dossier recompressé par le Finder avec ses ressources", async () => {
    const p = demo();
    const id = await assetPut(new Blob(["modèle conservé"]));
    p.items[0].asset = id;
    const original = unzipSync(
      new Uint8Array(await (await exportProject(p)).arrayBuffer()),
    );
    const nested = Object.fromEntries(
      Object.entries(original).map(([name, bytes]) => [
        "roomora-plan-simplifie/" + name,
        bytes,
      ]),
    );
    nested["__MACOSX/roomora-plan-simplifie/._project.json"] = new Uint8Array([
      0,
    ]);
    const restored = await importProject(
      new Blob([zipSync(nested) as Uint8Array<ArrayBuffer>]),
    );
    expect(restored.walls).toEqual(p.walls);
    expect(await (await assetGet(restored.items[0].asset!))!.text()).toBe(
      "modèle conservé",
    );
  });
  it("refuse une archive invalide", async () => {
    await expect(importProject(new Blob(["incorrect"]))).rejects.toThrow();
  });
  it("conserve les meubles de la bibliothèque indépendamment des projets", async () => {
    const i = demo().items[0];
    await libraryPut(i);
    expect((await library()).find((v) => v.id === i.id)).toEqual(i);
    await libraryDelete(i.id);
    expect((await library()).find((v) => v.id === i.id)).toBeUndefined();
  });
});

describe("Stockage binaire compatible WebKit", () => {
  it("stocke des ArrayBuffer, conserve les octets et le type MIME sur plusieurs fragments", async () => {
    const bytes = new Uint8Array(LOCAL_CHUNK_SIZE + 37);
    bytes[0] = 23;
    bytes[LOCAL_CHUNK_SIZE - 1] = 42;
    bytes[LOCAL_CHUNK_SIZE] = 81;
    bytes[bytes.length - 1] = 199;
    const id = await assetPut(new Blob([bytes], { type: "model/gltf-binary" }));
    const d = await openDB("roomora", 1),
      record = await d.get("assets", id);
    expect(record.format).toBe("krasroom-bytes-v1");
    expect(record.parts).toBe(2);
    expect(
      await d.get("assets", ["binary-part", id, record.generation, 0]),
    ).toBeInstanceOf(ArrayBuffer);
    d.close();
    const loaded = (await assetGet(id))!;
    expect(loaded.type).toBe("model/gltf-binary");
    expect([
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", await loaded.arrayBuffer()),
      ),
    ]).toEqual([
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]);
  });
  it("lit les anciens Blobs et permet de les remplacer sans migration ni perte", async () => {
    const id = crypto.randomUUID(),
      d = await openDB("roomora", 1);
    await d.put(
      "assets",
      new Blob(["ancien meuble"], { type: "model/gltf+json" }),
      id,
    );
    d.close();
    expect(await (await assetGet(id))!.text()).toBe("ancien meuble");
    await assetPut(
      new Blob(["nouveau meuble"], { type: "model/gltf+json" }),
      id,
    );
    expect(await (await assetGet(id))!.text()).toBe("nouveau meuble");
  });
  it("conserve le fichier précédent et nettoie les nouveaux fragments si l’écriture échoue", async () => {
    const id = await assetPut(new Blob(["à conserver"]));
    const original = IDBObjectStore.prototype.put;
    let writes = 0;
    const spy = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(function (this: IDBObjectStore, value, key) {
        if (value instanceof ArrayBuffer && ++writes === 2)
          throw new DOMException(
            "storage quota exceeded",
            "QuotaExceededError",
          );
        return original.call(this, value, key!);
      });
    try {
      await expect(
        assetPut(new Blob([new Uint8Array(LOCAL_CHUNK_SIZE + 5)]), id),
      ).rejects.toThrow("stockage local de cet appareil est plein");
      expect(await (await assetGet(id))!.text()).toBe("à conserver");
      const d = await openDB("roomora", 1),
        keys = await d.getAllKeys("assets");
      expect(
        keys.filter((key) => Array.isArray(key) && key[1] === id),
      ).toHaveLength(1);
      d.close();
    } finally {
      spy.mockRestore();
    }
  });
  it("restaure aussi une ressource vide sans fragment", async () => {
    const id = await assetPut(
      new Blob([], { type: "application/octet-stream" }),
    );
    const loaded = (await assetGet(id))!;
    expect(loaded.size).toBe(0);
    expect(loaded.type).toBe("application/octet-stream");
  });
});
