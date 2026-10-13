import "fake-indexeddb/auto";
import { zipSync, unzipSync } from "fflate";
import { describe, it, expect } from "vitest";
import { demo } from "./model";
import {
  saveProject,
  projects,
  removeProject,
  assetPut,
  assetGet,
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
