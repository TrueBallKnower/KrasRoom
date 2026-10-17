import { test, expect } from "@playwright/test";

test("espace de travail : bibliothèque repliable, import accessible et retour au catalogue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const library = page.getByRole("complementary", {
    name: "Bibliothèque et construction",
  });
  const toggle = page.getByRole("button", {
    name: "Afficher ou masquer la bibliothèque",
    exact: true,
  });
  const plan = page.locator(".plan-svg");
  await expect(library).toBeVisible();
  const before = (await plan.boundingBox())!.width;
  await toggle.click();
  await expect(library).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () => (await plan.boundingBox())!.width)
    .toBeGreaterThan(before + 250);
  await page
    .getByRole("button", { name: "Ouvrir le mobilier", exact: true })
    .click();
  await expect(library).toBeVisible();
  await library.locator(".library-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const add = library.getByRole("button", {
    name: "Ajouter mon propre meuble",
    exact: true,
  });
  await expect(add).toBeInViewport();
  await add.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await toggle.click();
  await page
    .getByRole("button", { name: "Construction et plans", exact: true })
    .click();
  await expect(library).toBeVisible();
  await expect(
    library.getByRole("button", {
      name: "Créer la 3D depuis mon plan",
      exact: true,
    }),
  ).toBeVisible();
});

test("panneaux 3D : replier les réglages sans perdre leur état", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  const navigation = page.getByRole("button", {
    name: "Navigation 3D",
    exact: true,
  });
  await expect(navigation).toHaveAttribute("aria-expanded", "true");
  await navigation.press("Space");
  await expect(navigation).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: "Dessus", exact: true }),
  ).toBeHidden();
  await navigation.click();
  await expect(
    page.getByRole("button", { name: "Dessus", exact: true }),
  ).toBeVisible();
  const settings = page.locator(".render-controls");
  await settings.getByLabel("Murs transparents", { exact: true }).uncheck();
  await settings.locator("summary").press("Space");
  await expect(
    settings.getByLabel("Style de rendu", { exact: true }),
  ).toBeHidden();
  await settings.locator("summary").click();
  await expect(
    settings.getByLabel("Style de rendu", { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByLabel("Murs transparents", { exact: true }),
  ).not.toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Exporter", exact: true }),
  ).toBeInViewport({ ratio: 1 });
});
