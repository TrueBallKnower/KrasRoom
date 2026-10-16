import { test, expect } from "@playwright/test";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";
import { demo } from "../src/model";
import { cloudTestService } from "./cloudTestService";

test("un téléphone refusant les Blobs IndexedDB récupère réellement les fichiers du cloud et les conserve après rechargement", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const service = await cloudTestService(browser, true);
  const { a, b, c, login } = service;
  for (const context of [a, b])
    await context.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (value, key) {
        if (value instanceof Blob)
          throw new DOMException(
            "Error preparing Blob/File data to be stored in object store",
            "UnknownError",
          );
        return key === undefined
          ? put.call(this, value)
          : put.call(this, value, key);
      };
    });
  try {
    const laptop = await a.newPage(),
      phone = await b.newPage();
    await login(laptop);
    await laptop.getByRole("button", { name: "Fermer", exact: true }).click();
    const binary = Buffer.from(
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]).buffer,
    );
    const model = strToU8(
      JSON.stringify({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
        buffers: [
          {
            uri:
              "data:application/octet-stream;base64," +
              binary.toString("base64"),
            byteLength: 36,
          },
        ],
        bufferViews: [{ buffer: 0, byteLength: 36 }],
        accessors: [
          {
            bufferView: 0,
            componentType: 5126,
            count: 3,
            type: "VEC3",
            min: [0, 0, 0],
            max: [1, 1, 1],
          },
        ],
        extras: { padding: "x".repeat(4 * 1024 * 1024 + 37) },
      }),
    );
    const p = demo();
    p.name = "Appartement Safari";
    p.items = [p.items[0]];
    p.items[0].asset = "modele-original";
    p.items[0].name = "Canapé récupéré";
    await laptop.locator('input[accept=".zip"]').setInputFiles({
      name: "safari.roomora.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(
        zipSync({
          "project.json": strToU8(JSON.stringify(p)),
          "assets/modele-original": model,
        }),
      ),
    });
    await expect(laptop.locator("footer")).toContainText("1 meubles");
    await laptop.getByRole("button", { name: /Mon compte/ }).click();
    await laptop
      .getByRole("button", {
        name: "Sauvegarder cet appartement en ligne",
        exact: true,
      })
      .click();
    await expect(
      laptop.getByText(
        "Appartement sauvegardé en ligne, avec ses modèles 3D.",
        { exact: true },
      ),
    ).toBeVisible();
    await login(phone);
    await expect(phone.locator("footer")).toContainText("1 meubles", {
      timeout: 20000,
    });
    await expect(phone.getByRole("alert")).toHaveCount(0);
    await phone.getByRole("button", { name: "Fermer", exact: true }).click();
    await phone.reload();
    await expect(phone.locator("footer")).toContainText("1 meubles");
    await expect(phone.locator(".saved")).toContainText("Enregistré");
    const downloaded = phone.waitForEvent("download");
    await phone.getByRole("button", { name: "Exporter", exact: true }).click();
    const stream = await (await downloaded).createReadStream();
    const chunks: Buffer[] = [];
    for await (const part of stream!) chunks.push(part);
    const archive = unzipSync(Buffer.concat(chunks));
    const restored = JSON.parse(strFromU8(archive["project.json"]));
    expect(restored.items[0].name).toBe("Canapé récupéré");
    expect(
      Buffer.compare(
        Buffer.from(archive["assets/" + restored.items[0].asset]),
        Buffer.from(model),
      ),
    ).toBe(0);
  } finally {
    await Promise.all([a.close(), b.close(), c.close()]);
  }
});
