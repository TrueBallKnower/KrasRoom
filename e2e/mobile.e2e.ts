import { test, expect, type Page, type CDPSession } from "@playwright/test";

async function touch(
  client: CDPSession,
  type: "touchStart" | "touchMove" | "touchEnd",
  points: { x: number; y: number; id: number }[],
) {
  await client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
}
async function slide(
  client: CDPSession,
  from: { x: number; y: number },
  dx: number,
  dy: number,
) {
  await touch(client, "touchStart", [{ ...from, id: 1 }]);
  for (let i = 1; i <= 8; i++)
    await touch(client, "touchMove", [
      { x: from.x + (dx * i) / 8, y: from.y + (dy * i) / 8, id: 1 },
    ]);
  await touch(client, "touchEnd", []);
}
async function ready(page: Page, baseURL: string | undefined) {
  await page.goto(baseURL || "http://127.0.0.1:5173/");
  await expect(page.locator(".saved")).toContainText("Enregistré");
}

test("téléphone : ajouter et modifier un meuble avec des panneaux tactiles sans masquer le plan", async ({
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
    await ready(page, baseURL);
    await expect(page.locator("aside.left")).toBeHidden();
    await expect(page.locator("aside.right")).toBeHidden();
    expect(
      (await page.locator(".plan-svg").boundingBox())!.width,
    ).toBeGreaterThan(370);
    await page.getByRole("button", { name: "Bibliothèque", exact: true }).tap();
    const library = page.getByRole("dialog", {
      name: "Bibliothèque et construction",
    });
    await expect(library).toBeVisible();
    await library
      .locator(".furniture-card")
      .filter({ hasText: "Canapé" })
      .first()
      .tap();
    await expect(library).toHaveCount(0);
    await expect(page.locator("footer")).toContainText("6 meubles");
    await page.getByRole("button", { name: /Propriétés/ }).tap();
    await expect(
      page.getByRole("dialog", { name: "Propriétés de la sélection" }),
    ).toBeVisible();
    await page.getByLabel("Largeur", { exact: true }).fill("2.8");
    await page.getByLabel("Largeur", { exact: true }).press("Tab");
    await page
      .getByRole("button", { name: "Fermer les propriétés", exact: true })
      .tap();
    await page.getByRole("button", { name: /Propriétés/ }).tap();
    await expect(page.getByLabel("Largeur", { exact: true })).toHaveValue(
      "2.8",
    );
    await page
      .getByRole("button", { name: "Fermer les propriétés", exact: true })
      .tap();
    // iOS versions without the Fullscreen API must keep the editor usable.
    await page.evaluate(() =>
      Object.defineProperty(document.documentElement, "requestFullscreen", {
        value: undefined,
        configurable: true,
      }),
    );
    await page.getByTitle("Plein écran", { exact: true }).tap();
    await expect(
      page.getByText(
        "Pour une vue sans barres du navigateur, ajoutez KrasRoom à l’écran d’accueil.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: /Mon compte/ }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).tap();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 320, height: 720 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: "/tmp/krasroom-phone.png" });
  } finally {
    await context.close();
  }
});

test("tablette : déplacer au doigt, pincer pour zoomer sans créer de murs, et changer d’orientation", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage(),
      client = await context.newCDPSession(page);
    await ready(page, baseURL);
    const item = page.locator('g[data-item="true"]').first();
    const before = await item.getAttribute("transform"),
      box = (await item.locator(":scope > rect").boundingBox())!;
    await slide(
      client,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      60,
      35,
    );
    await expect(item).not.toHaveAttribute("transform", before!);
    await page
      .getByRole("button", {
        name: "Tracer des murs — outil rapide",
        exact: true,
      })
      .tap();
    const walls = await page.locator("footer").textContent();
    const svg = page.locator(".plan-svg"),
      view = await svg.getAttribute("viewBox"),
      rect = (await svg.boundingBox())!;
    const x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2;
    await touch(client, "touchStart", [
      { x: x - 45, y, id: 1 },
      { x: x + 45, y, id: 2 },
    ]);
    await touch(client, "touchMove", [
      { x: x - 100, y: y + 20, id: 1 },
      { x: x + 100, y: y + 20, id: 2 },
    ]);
    await touch(client, "touchEnd", []);
    await expect(svg).not.toHaveAttribute("viewBox", view!);
    expect(await page.locator("footer").textContent()).toBe(walls);
    // Gesture must not leave a wall endpoint; changing tools clears any draft.
    await page
      .getByRole("button", { name: "Sélectionner — outil rapide", exact: true })
      .tap();
    await page.setViewportSize({ width: 1180, height: 820 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(
      page.getByRole("button", { name: "Bibliothèque", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: "/tmp/krasroom-tablet.png" });
  } finally {
    await context.close();
  }
});

test("visite tactile : regarder au doigt, avancer sans clavier et quitter le plein écran", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage(),
      client = await context.newCDPSession(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await ready(page, baseURL);
    await page.getByRole("button", { name: "Visite", exact: true }).tap();
    const canvas = page.locator("canvas");
    const before = await canvas.screenshot();
    const box = (await canvas.boundingBox())!;
    await slide(
      client,
      { x: box.x + box.width * 0.7, y: box.y + box.height * 0.5 },
      -60,
      15,
    );
    const looked = await canvas.screenshot();
    expect(before.equals(looked)).toBe(false);
    const button = page.getByRole("button", { name: "Avancer", exact: true }),
      b = (await button.boundingBox())!;
    await touch(client, "touchStart", [
      { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 4 },
    ]);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(500);
    const moved = await canvas.screenshot();
    await touch(client, "touchEnd", []);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    expect(looked.equals(moved)).toBe(false);
    expect(
      await page.evaluate(() => document.pointerLockElement === null),
    ).toBe(true);
    await page.getByRole("button", { name: "Affichage", exact: true }).tap();
    await page
      .getByRole("button", { name: "Visite sans interface · L", exact: true })
      .tap();
    await expect(page.locator(".app")).toHaveClass(/immersive-visit/);
    await expect(button).toBeVisible();
    await page.getByRole("button", { name: /Afficher l’interface/ }).tap();
    await expect(page.locator(".app")).not.toHaveClass(/immersive-visit/);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("3D tactile : déplacer un meuble et zoomer à deux doigts sans déplacer le mobilier", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage(),
      client = await context.newCDPSession(page);
    await ready(page, baseURL);
    await page.getByRole("button", { name: /Appartement · 48/ }).tap();
    await page
      .getByRole("button", { name: "Nouvel appartement", exact: true })
      .tap();
    await page.getByRole("button", { name: "Bibliothèque", exact: true }).tap();
    await page.getByRole("button", { name: "Mobilier", exact: true }).tap();
    await page
      .locator("aside.left .furniture-card")
      .filter({ hasText: "Canapé" })
      .first()
      .tap();
    const initialX = await page
      .getByLabel("Position X", { exact: true })
      .inputValue();
    await page.getByRole("button", { name: "Vue 3D", exact: true }).tap();
    const canvas = page.locator("canvas");
    await canvas.screenshot();
    const box = (await canvas.boundingBox())!;
    // Furniture is centered in this otherwise empty project.
    await slide(
      client,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      65,
      30,
    );
    await expect(
      page.getByLabel("Position X", { exact: true }),
    ).not.toHaveValue(initialX);
    const movedX = await page
        .getByLabel("Position X", { exact: true })
        .inputValue(),
      movedY = await page
        .getByLabel("Position Y", { exact: true })
        .inputValue();
    const snapshot = () =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((k) =>
          k.startsWith("roomora-camera-"),
        );
        return key ? localStorage.getItem(key) : null;
      });
    // Orbit from empty space first to establish a saved camera position.
    await slide(
      client,
      { x: box.x + box.width * 0.9, y: box.y + box.height * 0.2 },
      -50,
      15,
    );
    await expect.poll(snapshot).not.toBeNull();
    await expect(page.getByLabel("Position X", { exact: true })).toHaveValue(
      movedX,
    );
    await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue(
      movedY,
    );
    const before = await snapshot(),
      x = box.x + box.width * 0.6,
      y = box.y + box.height * 0.5;
    await touch(client, "touchStart", [
      { x: x - 35, y, id: 1 },
      { x: x + 35, y, id: 2 },
    ]);
    for (let i = 1; i <= 6; i++)
      await touch(client, "touchMove", [
        { x: x - 35 - i * 8, y, id: 1 },
        { x: x + 35 + i * 8, y, id: 2 },
      ]);
    await touch(client, "touchEnd", []);
    await expect.poll(snapshot).not.toBe(before);
    await expect(page.getByLabel("Position X", { exact: true })).toHaveValue(
      movedX,
    );
    await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue(
      movedY,
    );
  } finally {
    await context.close();
  }
});
