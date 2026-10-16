import { test, expect } from "@playwright/test";
import { cloudTestService } from "./cloudTestService";
// Deterministic fake transport only: never sends credentials or files to a real service.
test("deux navigateurs retrouvent les meubles et les modifications, sans écraser une version concurrente (service simulé)", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const service = await cloudTestService(browser);
  const { owner, rows, writes, blocked, reads, a, b, c, login } = service;
  try {
    const pa = await a.newPage(),
      pb = await b.newPage(),
      pc = await c.newPage();
    await login(pa);
    await pa.getByRole("button", { name: "Fermer", exact: true }).click();
    const binary = Buffer.from(
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]).buffer,
    );
    const model = {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      buffers: [
        {
          uri:
            "data:application/octet-stream;base64," + binary.toString("base64"),
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
    };
    await pa.locator('input[accept=".glb,.gltf,.zip"]').setInputFiles({
      name: "meuble-cloud.gltf",
      mimeType: "model/gltf+json",
      buffer: Buffer.from(JSON.stringify(model)),
    });
    await expect(pa.getByLabel("Nom", { exact: true })).toHaveValue(
      "meuble-cloud",
    );
    await pa.getByRole("button", { name: /Mon compte/ }).click();
    await pa
      .getByRole("button", {
        name: "Sauvegarder cet appartement en ligne",
        exact: true,
      })
      .click();
    await expect(
      pa.getByText("Appartement sauvegardé en ligne, avec ses modèles 3D.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(service.uploads).toBe(1);
    const first = [...rows.values()][0],
      id = first.project_id;
    await login(pb);
    await expect(pb.locator(".modal .project-list button")).toHaveCount(1);
    // A fresh device resumes the cloud apartment without clicking its row.
    await expect(pb.locator("footer")).toContainText("6 meubles");
    await pb.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(pb.getByRole("dialog")).toHaveCount(0);
    await expect(pb.locator("footer")).toContainText("6 meubles");
    await pb.locator('g[data-item="true"]').last().click({ force: true });
    await expect(pb.getByLabel("Nom", { exact: true })).toHaveValue(
      "meuble-cloud",
    );
    const oldRevision = rows.get(owner + "/" + id).revision;
    await pb.getByLabel("Position X", { exact: true }).fill("2.5");
    await expect
      .poll(() => rows.get(owner + "/" + id).revision, { timeout: 15000 })
      .not.toBe(oldRevision);
    expect(service.uploads).toBe(1);
    // Returning to a clean device pulls the new revision automatically.
    await pa.getByRole("button", { name: "Fermer", exact: true }).click();
    await pa.getByRole("button", { name: "Plan 2D", exact: true }).click();
    await pa.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(pa.locator(".account-button")).toHaveAttribute(
      "title",
      "À jour",
    );
    await expect
      .poll(async () => pa.locator('g[data-item="true"]').count())
      .toBe(6);
    await pa.locator('g[data-item="true"]').last().click({ force: true });
    await expect(pa.getByLabel("Position X", { exact: true })).toHaveValue(
      "2.5",
    );
    // Session restoration also resumes the current cloud apartment after reload.
    const readsBeforeReload = reads.get(a) || 0;
    await pa.reload();
    await expect(pa.locator("footer")).toContainText("6 meubles");
    await pa.locator('g[data-item="true"]').last().click({ force: true });
    await expect(pa.getByLabel("Position X", { exact: true })).toHaveValue(
      "2.5",
    );
    // Wait for auth restoration and its revision read, not only the local IDB view.
    await expect
      .poll(() => reads.get(a) || 0)
      .toBeGreaterThan(readsBeforeReload);
    await expect(pa.locator(".account-button")).not.toContainText("Synchro");
    // A works offline while B edits: create a genuine concurrent change.
    blocked.add(a);
    await a.setOffline(true);
    await pa.getByLabel("Position X", { exact: true }).fill("1.5");
    const secondRevision = rows.get(owner + "/" + id).revision;
    await pb.getByLabel("Position X", { exact: true }).fill("3.5");
    await pb.getByRole("button", { name: /Mon compte/ }).click();
    await pb
      .getByRole("button", {
        name: "Sauvegarder cet appartement en ligne",
        exact: true,
      })
      .click();
    await expect
      .poll(() => rows.get(owner + "/" + id).revision)
      .not.toBe(secondRevision);
    await expect
      .poll(() => rows.get(owner + "/" + id).document.project.items.at(-1).x)
      .toBe(3.5);
    await pb.getByRole("button", { name: "Fermer", exact: true }).click();
    blocked.delete(a);
    await a.setOffline(false);
    await pa.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(pa.getByLabel("Position X", { exact: true })).toHaveValue(
      "1.5",
    );
    await pa.getByRole("button", { name: /Mon compte/ }).click();
    await pa
      .getByRole("button", {
        name: "Sauvegarder cet appartement en ligne",
        exact: true,
      })
      .click();
    try {
      await expect(pa.getByRole("alert")).toContainText(
        "Une autre version existe en ligne",
      );
    } catch (error) {
      console.log(
        "Cloud conflict diagnostics",
        JSON.stringify({
          writes,
          modal: await pa.getByRole("dialog").innerText(),
        }),
      );
      throw error;
    }
    await login(pc, "other@example.com");
    await expect(
      pc.getByText("Aucun appartement en ligne pour le moment.", {
        exact: true,
      }),
    ).toBeVisible();
    // Loading from the second device reuses the real model bytes in its export.
    const download = pb.waitForEvent("download");
    await pb.getByRole("button", { name: "Exporter", exact: true }).click();
    const stream = await (await download).createReadStream(),
      chunks = [];
    for await (const v of stream!) chunks.push(v);
    const { unzipSync, strFromU8 } = await import("fflate"),
      zip = unzipSync(Buffer.concat(chunks)),
      project = JSON.parse(strFromU8(zip["project.json"])),
      item = project.items.find(
        (i: { name: string }) => i.name === "meuble-cloud",
      );
    expect(item.x).toBe(3.5);
    expect(strFromU8(zip["assets/" + item.asset])).toContain(
      binary.toString("base64"),
    );
  } finally {
    await a.close();
    await b.close();
    await c.close();
  }
});
