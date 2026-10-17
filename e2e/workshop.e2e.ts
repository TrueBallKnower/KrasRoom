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
  const modal = page.getByRole("main", { name: "Studio mobilier" });
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
  await modal
    .getByRole("button", { name: "Retour à l’appartement", exact: true })
    .click();
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
  await expect(
    modal.getByRole("button", {
      name: "Reprendre la création sélectionnée",
      exact: true,
    }),
  ).toBeEnabled();
  await page.keyboard.press("Delete");
  await expect(
    modal.getByLabel("Forme sélectionnée", { exact: true }).locator("option"),
  ).toHaveCount(5);
  await page.keyboard.press("Control+z");
  await expect(
    modal.getByLabel("Forme sélectionnée", { exact: true }).locator("option"),
  ).toHaveCount(6);
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
  await expect(page.locator(".saved")).toContainText("Enregistré");
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
    const modal = page.getByRole("main", { name: "Studio mobilier" });
    await modal.getByRole("button", { name: "Composants", exact: true }).tap();
    await modal
      .getByLabel("Point de départ", { exact: true })
      .selectOption("empty");
    await modal
      .getByLabel("Nom de la création", { exact: true })
      .fill("Meuble mobile");
    await modal
      .getByRole("button", { name: "Propriétés de la forme", exact: true })
      .tap();
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

test("studio plein écran : déplacer un composant avec le gizmo, annuler et revenir à son appartement", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("./");
  await expect(page.locator(".saved")).toContainText("Enregistré");
  await page
    .getByRole("button", { name: "Studio mobilier", exact: true })
    .first()
    .click();
  const studio = page.getByRole("main", { name: "Studio mobilier" });
  await expect(page).toHaveURL(/#studio$/);
  await expect(page.locator(".workspace")).toHaveCount(0);
  await expect(page.locator(".modal-overlay")).toHaveCount(0);
  await studio
    .getByLabel("Point de départ", { exact: true })
    .selectOption("empty");
  const box = (await studio.locator(".creator-preview").boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.width).toBeGreaterThan(viewport.width * 0.5);
  expect(box.height).toBeGreaterThan(viewport.height * 0.6);
  await expect(studio.locator("canvas")).toHaveCount(1);
  await studio.getByRole("button", { name: "Face", exact: true }).click();
  await studio.locator("canvas").screenshot();
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(center.x + 35, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 115, center.y, { steps: 12 });
  await page.mouse.up();
  await expect(
    studio.getByLabel("Position X de la forme", { exact: true }),
  ).not.toHaveValue("0");
  await studio
    .getByRole("button", { name: "Annuler la création", exact: true })
    .click();
  await expect(
    studio.getByLabel("Position X de la forme", { exact: true }),
  ).toHaveValue("0");
  await studio
    .getByRole("button", { name: "Redimensionner la forme", exact: true })
    .click();
  await studio.locator("canvas").screenshot();
  await page.mouse.move(center.x + 35, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 95, center.y, { steps: 12 });
  await page.mouse.up();
  await expect(
    studio.getByLabel("Largeur de la forme", { exact: true }),
  ).not.toHaveValue("1");
  await studio
    .getByRole("button", { name: "Annuler la création", exact: true })
    .click();
  await expect(
    studio.getByLabel("Largeur de la forme", { exact: true }),
  ).toHaveValue("1");
  await studio
    .getByRole("button", { name: "Tourner la forme", exact: true })
    .click();
  await expect(
    studio.getByRole("button", { name: "Tourner la forme", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await studio
    .getByRole("button", { name: "Plein écran du studio", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fullscreenElement?.classList.contains("studio-workspace"),
      ),
    )
    .toBe(true);
  await studio
    .getByRole("button", { name: "Plein écran du studio", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  await studio
    .getByRole("button", { name: "Retour à l’appartement", exact: true })
    .click();
  await expect(studio).toHaveCount(0);
  await expect(page.locator("footer")).toContainText("5 meubles");
  await expect(page).not.toHaveURL(/#studio$/);
  await page
    .getByRole("button", { name: "Studio mobilier", exact: true })
    .first()
    .click();
  await expect(studio).toBeVisible();
  await page.goBack();
  await expect(studio).toHaveCount(0);
  await expect(page.locator("footer")).toContainText("5 meubles");
});
