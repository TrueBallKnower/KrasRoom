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

test("les panneaux restent séparés en visite et en 3D, même dans une fenêtre basse", async ({
  page,
}) => {
  await page.goto("/");
  const display = page.getByRole("button", { name: "Affichage", exact: true });
  const dock = page.locator(".scene-settings-dock");
  const separated = async (a: string, b: string) => {
    const first = await page.locator(a).boundingBox();
    const second = await page.locator(b).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    const x =
      Math.min(first!.x + first!.width, second!.x + second!.width) -
      Math.max(first!.x, second!.x);
    const y =
      Math.min(first!.y + first!.height, second!.y + second!.height) -
      Math.max(first!.y, second!.y);
    expect(x <= 0 || y <= 0, `${a} chevauche ${b}`).toBe(true);
  };
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 600 },
    { width: 820, height: 768 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page.getByRole("button", { name: "Visite", exact: true }).click();
    await expect(dock).toBeHidden();
    await expect(page.locator(".drawing-toolbar")).toBeHidden();
    await display.click();
    await expect(
      page.getByLabel("Hauteur des yeux", { exact: true }),
    ).toBeVisible();
    await page.locator(".render-controls summary").click();
    await separated(".visit-settings", ".render-controls");
    await separated(".viewport-toolbar", ".scene-settings-dock");
    const capture = dock.getByRole("button", {
      name: "Capture PNG",
      exact: true,
    });
    await capture.scrollIntoViewIfNeeded();
    await expect(capture).toBeInViewport({ ratio: 1 });
    await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
    if (await dock.isHidden()) await display.click();
    await separated(".camera-toolbar", ".render-controls");
    await separated(".viewport-toolbar", ".scene-settings-dock");
    await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
    await expect(page.locator(".drawing-toolbar")).toBeVisible();
    await separated(".viewport-toolbar", ".drawing-toolbar");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("espace dégagé : retrouver les panneaux et garder la visite immersive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const toggle = page.getByRole("button", {
    name: "Dégager l’espace de travail",
    exact: true,
  });
  const left = page.getByRole("complementary", {
    name: "Bibliothèque et construction",
  });
  const right = page.getByRole("complementary", {
    name: "Propriétés de la sélection",
  });
  const width = (await page.locator(".plan-svg").boundingBox())!.width;
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(left).toBeHidden();
  await expect(right).toBeHidden();
  await expect
    .poll(async () => (await page.locator(".plan-svg").boundingBox())!.width)
    .toBeGreaterThan(width + 500);
  await page
    .getByRole("button", {
      name: "Afficher ou masquer la bibliothèque",
      exact: true,
    })
    .click();
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  await toggle.click();
  await page.getByRole("button", { name: "Visite", exact: true }).click();
  await page.keyboard.press("l");
  await expect(page.locator(".app")).toHaveClass(/immersive-visit/);
  await expect
    .poll(async () => (await page.locator("canvas").boundingBox())!.width)
    .toBeCloseTo(1440, 0);
  await page.keyboard.press("l");
  await toggle.click();
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await toggle.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});
