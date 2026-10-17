import { test, expect, type Download, type Page } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
async function bytes(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  return Buffer.concat(chunks);
}
async function brightness(page: Page) {
  return page.locator("canvas").evaluate((canvas) => {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(canvas as HTMLCanvasElement, 0, 0, 96, 96);
    const a = ctx.getImageData(0, 0, 96, 96).data;
    let n = 0;
    for (let i = 0; i < a.length; i += 4) n += a[i] + a[i + 1] + a[i + 2];
    return n / (96 * 96 * 3);
  });
}
test("nuit : placer une source, éclairer réellement, orienter un spot et restaurer ses réglages", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Lumières et ambiance", exact: true })
    .click();
  await page.getByRole("button", { name: "Nuit", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: /Ajouter plafonnier/ }).click();
  await page
    .getByLabel("Style de rendu", { exact: true })
    .selectOption("realistic");
  await page.getByLabel("Exposition du rendu", { exact: true }).fill("1.3");
  await page.getByRole("button", { name: "Jour", exact: true }).click();
  await page.getByRole("button", { name: "Nuit", exact: true }).click();
  await expect(
    page.getByLabel("Lumière allumée", { exact: true }),
  ).toBeChecked();
  await expect(
    page.getByLabel("Hauteur de la lumière", { exact: true }),
  ).toHaveValue("2.35");
  await page.getByLabel("Lumière allumée", { exact: true }).uncheck();
  await page.locator("canvas").screenshot();
  const off = await brightness(page);
  await page.getByLabel("Lumière allumée", { exact: true }).check();
  await expect.poll(() => brightness(page)).toBeGreaterThan(off + 3);
  await page
    .getByLabel("Intensité de la lumière", { exact: true })
    .fill("2400");
  await page.getByLabel("Hauteur de la lumière", { exact: true }).fill("2.1");
  await page
    .getByLabel("Couleur de la lumière", { exact: true })
    .fill("#ffcc99");
  await page
    .getByLabel("Type de lumière", { exact: true })
    .selectOption("spot");
  await page.getByLabel("Inclinaison du spot", { exact: true }).fill("45");
  await page.getByRole("button", { name: "Dupliquer", exact: true }).click();
  await expect(page.locator(".light-list > div")).toHaveCount(2);
  await page.getByTitle("Annuler · ⌘Z").click();
  await expect(page.locator(".light-list > div")).toHaveCount(1);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const zip = unzipSync(await bytes(await pending));
  const project = JSON.parse(strFromU8(zip["project.json"]));
  expect(project.environment.lighting).toBe("night");
  expect(project.environment.exposure).toBe(1.3);
  const light = project.items.find((i: any) => i.kind === "light");
  expect(light.light).toMatchObject({
    enabled: true,
    lumens: 2400,
    color: "#ffcc99",
    type: "spot",
    tilt: 45,
  });
  expect(light.elevation).toBe(2.1);
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Lumières et ambiance", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Nuit", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Modifier Plafonnier", exact: true })
    .click();
  await expect(
    page.getByLabel("Hauteur de la lumière", { exact: true }),
  ).toHaveValue("2.1");
  await expect(
    page.getByLabel("Intensité de la lumière", { exact: true }),
  ).toHaveValue("2400");
  expect(errors).toEqual([]);
});
test("mode Pro : exporter un plan à l’échelle et un quantitatif, appliquer des dimensions de murs et revenir au mode Simple", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Outils d’architecture" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Niveau d’interface", { exact: true })
    .selectOption("pro");
  await expect(
    page.getByRole("region", { name: "Outils d’architecture" }),
  ).toBeVisible();
  await page
    .getByLabel("Échelle du plan technique", { exact: true })
    .selectOption("50");
  const plan = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporter le plan à l’échelle", exact: true })
    .click();
  const svg = (await bytes(await plan)).toString();
  expect(svg).toContain("1:50");
  expect(svg).toContain('width="');
  expect(svg).toContain('mm"');
  expect(svg).toContain("Séjour");
  const csv = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exporter le quantitatif CSV", exact: true })
    .click();
  expect((await bytes(await csv)).toString()).toContain("Faces de murs nettes");
  await page.getByText("Réglages communs des murs", { exact: true }).click();
  await page.getByLabel("Hauteur commune des murs", { exact: true }).fill("3");
  await page
    .getByLabel("Épaisseur commune des murs", { exact: true })
    .fill("0.2");
  await page
    .getByRole("button", {
      name: "Appliquer à tous les murs du projet",
      exact: true,
    })
    .click();
  const archive = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const p = JSON.parse(
    strFromU8(unzipSync(await bytes(await archive))["project.json"]),
  );
  expect(p.walls.every((w: any) => w.height === 3 && w.thickness === 0.2)).toBe(
    true,
  );
  await page
    .getByLabel("Niveau d’interface", { exact: true })
    .selectOption("simple");
  await expect(
    page.getByRole("region", { name: "Outils d’architecture" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByLabel("Niveau d’interface", { exact: true }),
  ).toHaveValue("simple");
});
test("téléphone : ajouter une lumière et régler sa hauteur sans clavier 3D", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Ouvrir les lumières", exact: true })
    .click();
  await page.getByRole("button", { name: "Nuit", exact: true }).click();
  await page
    .getByRole("button", { name: /Ajouter lumière d’ambiance/ })
    .click();
  await expect(page.locator("aside.left")).toBeHidden();
  await page.getByRole("button", { name: /^Propriétés/ }).click();
  await page.getByLabel("Hauteur de la lumière", { exact: true }).fill("1.8");
  await expect(
    page.getByLabel("Hauteur de la lumière", { exact: true }),
  ).toHaveValue("1.8");
  await page.getByLabel("Lumière allumée", { exact: true }).uncheck();
  await expect(
    page.getByLabel("Lumière allumée", { exact: true }),
  ).not.toBeChecked();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
