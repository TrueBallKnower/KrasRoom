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
