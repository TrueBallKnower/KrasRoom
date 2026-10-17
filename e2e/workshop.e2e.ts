import { test, expect, type Download } from "@playwright/test";
async function bytes(download: Download) {
  const stream = await download.createReadStream(),
    parts: Buffer[] = [];
  for await (const p of stream!) parts.push(p);
  return Buffer.concat(parts);
}
function jsonGLB(buffer: Buffer) {
  expect(buffer.toString("ascii", 0, 4)).toBe("glTF");
  return JSON.parse(
    buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)).trim(),
  );
}
test("atelier : créer, conserver le brouillon, exporter et importer un vrai GLB compatible Blender", async ({
  page,
}) => {
  test.setTimeout(90000);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("./");
  await expect(page.locator(".saved")).toContainText("Enregistré");
  expect(requests.some((s) => s.includes("ModelCreator"))).toBe(false);
  await page
    .getByRole("button", {
      name: "Atelier 3D · créer et importer",
      exact: true,
    })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Nom de la création", { exact: true })
    .fill("Table du bureau");
  await modal.getByLabel("Largeur de la forme", { exact: true }).fill("1.8");
  await modal
    .getByRole("button", { name: "Ajouter un cylindre", exact: true })
    .click();
  await modal.getByLabel("Largeur de la forme", { exact: true }).fill("0.08");
  await modal
    .getByLabel("Profondeur de la forme", { exact: true })
    .fill("0.08");
  await modal.getByLabel("Hauteur de la forme", { exact: true }).fill("0.7");
  await modal
    .getByRole("button", { name: "Dupliquer la forme", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Annuler la création", exact: true })
    .click();
  await expect(
    modal.getByLabel("Forme sélectionnée", { exact: true }).locator("option"),
  ).toHaveCount(6);
  await expect(modal.getByText(/Brouillon enregistré/)).toBeVisible();
  const dl = page.waitForEvent("download");
  await modal
    .getByRole("button", {
      name: "Télécharger ma création en GLB",
      exact: true,
    })
    .click();
  const glb = await bytes(await dl),
    json = jsonGLB(glb);
  const recipe = json.nodes.find((n: any) => n.extras?.krasroomDesign)?.extras
    .krasroomDesign;
  expect(recipe.name).toBe("Table du bureau");
  expect(recipe.parts).toHaveLength(6);
  expect(recipe.parts[0].width).toBe(1.8);
  expect(json.meshes).toHaveLength(6);
  await modal.getByRole("button", { name: "Fermer", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Atelier 3D · créer et importer",
      exact: true,
    })
    .click();
  await expect(
    modal.getByLabel("Nom de la création", { exact: true }),
  ).toHaveValue("Table du bureau");
  await modal
    .getByRole("button", {
      name: "Ajouter ma création à l’appartement",
      exact: true,
    })
    .click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator("footer")).toContainText("6 meubles");
  await expect(page.getByLabel("Largeur", { exact: true })).toHaveValue("1.8");
  await page
    .getByRole("button", { name: "Atelier 3D · retirer le décor", exact: true })
    .click();
  await modal
    .getByRole("button", { name: "Créer un meuble", exact: true })
    .click();
  await modal
    .getByRole("button", {
      name: "Reprendre la création sélectionnée",
      exact: true,
    })
    .click();
  await expect(
    modal.getByLabel("Nom de la création", { exact: true }),
  ).toHaveValue("Table du bureau");
  await page.keyboard.press("Delete");
  await expect(page.locator("footer")).toContainText("6 meubles");
  await modal
    .getByRole("button", { name: "Depuis Blender", exact: true })
    .click();
  const input = modal.getByLabel(
    "Importer un modèle Blender (GLB, glTF ou ZIP)",
    { exact: true },
  );
  await input.setInputFiles({
    name: "scene.blend",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("BLENDER"),
  });
  await expect(modal.getByRole("alert")).toContainText(
    ".blend nécessite Blender",
  );
  await input.setInputFiles({
    name: "table-blender.glb",
    mimeType: "model/gltf-binary",
    buffer: glb,
  });
  await expect(modal).toHaveCount(0);
  await expect(page.locator("footer")).toContainText("7 meubles");
  await page.reload();
  await expect(page.locator("footer")).toContainText("7 meubles");
});

test("téléphone : créer un meuble léger, conserver ses dimensions et le retrouver après rechargement", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL || "http://127.0.0.1:5173/");
    await expect(page.locator(".saved")).toContainText("Enregistré");
    await page.getByRole("button", { name: "Bibliothèque", exact: true }).tap();
    await page
      .getByRole("button", {
        name: "Atelier 3D · créer et importer",
        exact: true,
      })
      .tap();
    const modal = page.getByRole("dialog");
    await modal
      .getByLabel("Point de départ", { exact: true })
      .selectOption("empty");
    await modal
      .getByLabel("Nom de la création", { exact: true })
      .fill("Meuble mobile");
    await modal.getByLabel("Largeur de la forme", { exact: true }).fill("0.6");
    await modal.getByLabel("Hauteur de la forme", { exact: true }).fill("0.4");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await modal
      .getByRole("button", {
        name: "Ajouter ma création à l’appartement",
        exact: true,
      })
      .tap();
    await expect(modal).toHaveCount(0);
    await expect(page.locator("footer")).toContainText("6 meubles");
    await page.getByRole("button", { name: /Propriétés/ }).tap();
    await expect(page.getByLabel("Largeur", { exact: true })).toHaveValue(
      "0.6",
    );
    await expect(page.getByLabel("Hauteur", { exact: true })).toHaveValue(
      "0.4",
    );
    await expect(page.locator(".saved")).toContainText("Enregistré");
    await page.reload();
    await expect(page.locator("footer")).toContainText("6 meubles");
  } finally {
    await context.close();
  }
});
