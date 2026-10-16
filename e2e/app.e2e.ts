import { test, expect } from "@playwright/test";
test("édition, annuler/rétablir, persistance et export complet", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Canapé 2.2 × 0.9 m" }).click();
  await expect(page.getByText("Votre meuble", { exact: true })).toBeVisible();
  await page.getByLabel("Nom", { exact: true }).fill("Canapé test");
  await page.getByLabel("Largeur", { exact: true }).fill("2.4");
  await expect(page.getByLabel("Largeur", { exact: true })).toHaveValue("2.4");
  await page.getByRole("button", { name: "Dupliquer", exact: true }).click();
  await expect(page.locator("footer")).toContainText("7 meubles");
  await page.getByTitle("Annuler · ⌘Z").click();
  await expect(page.locator("footer")).toContainText("6 meubles");
  await page.getByTitle("Rétablir · ⌘⇧Z").click();
  await expect(page.locator("footer")).toContainText("7 meubles");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("footer")).toContainText("7 meubles");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  expect((await dl).suggestedFilename()).toContain(".zip");
  await page.screenshot({ path: "/tmp/roomora-plan.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("modèle glTF intégré, rendu 3D et bibliothèque personnelle", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  const bytes = Buffer.from(
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]).buffer,
  );
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [
      {
        uri: "data:application/octet-stream;base64," + bytes.toString("base64"),
        byteLength: 36,
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
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
  await page
    .locator('input[type=file][accept=".glb,.gltf,.zip"]')
    .setInputFiles({
      name: "test.gltf",
      mimeType: "model/gltf+json",
      buffer: Buffer.from(JSON.stringify(gltf)),
    });
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("test");
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/tmp/roomora-3d.png", fullPage: true });
  await page.getByRole("button", { name: "Mes meubles", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "test 1 × 1 m" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("création de projet et murs à l’échelle", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Appartement · 48/ }).click();
  await page
    .getByRole("button", { name: "Nouvel appartement", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tracer des murs", exact: true })
    .click();
  const svg = page.locator(".plan-svg"),
    box = await svg.boundingBox();
  if (!box) throw Error("Plan absent");
  await svg.click({ position: { x: box.width * 0.25, y: box.height * 0.3 } });
  await svg.click({ position: { x: box.width * 0.6, y: box.height * 0.3 } });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Sélectionner", exact: true }).click();
  await expect(page.locator(".plan-svg line")).toHaveCount(1);
  await svg.click({ position: { x: box.width * 0.425, y: box.height * 0.3 } });
  await expect(page.getByLabel("Longueur", { exact: true })).toBeVisible();
  await page.getByLabel("Longueur", { exact: true }).fill("4");
  await expect(page.getByLabel("Longueur", { exact: true })).toHaveValue("4");
});

test("plan PDF, calibration et restauration ZIP avec un modèle GLB", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  // Build a self-contained GLB with a triangle, using the official binary layout.
  const binary = Buffer.from(
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]).buffer,
  );
  const model = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }],
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
  const json = Buffer.from(JSON.stringify(model));
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32);
  json.copy(padded);
  const glb = Buffer.alloc(28 + padded.length + binary.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);
  glb.writeUInt32LE(binary.length, 20 + padded.length);
  glb.writeUInt32LE(0x004e4942, 24 + padded.length);
  binary.copy(glb, 28 + padded.length);
  await page.locator('input[accept=".glb,.gltf,.zip"]').setInputFiles({
    name: "Triangle.glb",
    mimeType: "model/gltf-binary",
    buffer: glb,
  });
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("Triangle");
  // Minimal valid PDF with one vector plan page and an accurate xref table.
  const stream = "0.8 w 30 30 200 130 re S";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 4 0 R >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf +=
    "xref\n0 5\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await page
    .locator('input[accept=".pdf,.png,.jpg,.jpeg,.webp"]')
    .setInputFiles({
      name: "plan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(pdf),
    });
  await page
    .getByText("Je préfère utiliser le tracé manuel", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Utiliser comme fond de plan" })
    .click();
  await expect
    .poll(
      async () => {
        const error = (
          await page.locator(".auto-import [role=alert]").allTextContents()
        ).join(" ");
        if (error) throw Error("Import PDF : " + error);
        return page.locator(".plan-svg image").count();
      },
      { timeout: 20000 },
    )
    .toBe(1);
  const svg = page.locator(".plan-svg"),
    box = await svg.boundingBox();
  if (!box) throw Error("Plan absent");
  page.once("dialog", (d) => d.accept("4"));
  await svg.click({ position: { x: box.width * 0.2, y: box.height * 0.55 } });
  await svg.click({ position: { x: box.width * 0.55, y: box.height * 0.55 } });
  await expect(
    page.getByRole("status").filter({ hasText: "Échelle définie" }),
  ).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const path = await (await dl).path();
  if (!path) throw Error("Archive non téléchargée");
  await page.locator('input[accept=".zip"]').setInputFiles(path);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Projet et ressources restaurés" }),
  ).toBeVisible();
  await expect(page.locator(".plan-svg image")).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".plan-svg")).toContainText("Triangle");
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
});

test("meuble glissé dans le plan, placement contre un mur et interface mobile", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  const card = page.getByRole("button", { name: "Canapé 2.2 × 0.9 m" });
  await card.click();
  const item = page.locator(".plan-svg g[data-item]").last();
  const rect = await item.boundingBox();
  if (!rect) throw Error("Meuble absent");
  const before = await page
    .getByLabel("Position X", { exact: true })
    .inputValue();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + 60,
    rect.y + rect.height / 2 + 20,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByLabel("Position X", { exact: true })).not.toHaveValue(
    before,
  );
  await page.getByTitle("Annuler · ⌘Z").click();
  await item.locator(":scope > rect").click();
  await expect(page.getByLabel("Position X", { exact: true })).toHaveValue(
    before,
  );
  await page
    .getByRole("button", { name: "Placer contre le mur le plus proche" })
    .click();
  await expect(page.getByLabel("Position X", { exact: true })).not.toHaveValue(
    before,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Plan 2D", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/roomora-mobile.png" });
});

test("une image et 48 m² créent automatiquement murs, pièces, porte et fenêtre", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 360;
    c.height = 280;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 360, 280);
    ctx.fillStyle = "black";
    for (const [x, y, w, h] of [
      [25, 25, 310, 8],
      [25, 247, 310, 8],
      [25, 25, 8, 230],
      [327, 25, 8, 230],
      [200, 25, 7, 85],
      [200, 140, 7, 115],
    ])
      ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "white";
    ctx.fillRect(125, 25, 50, 8);
    ctx.fillStyle = "black";
    ctx.fillRect(125, 27, 50, 1);
    ctx.fillRect(125, 30, 50, 1);
    return c.toDataURL().split(",")[1];
  });
  const transfer = await page.evaluateHandle((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
      d = new DataTransfer();
    d.items.add(
      new File([bytes], "Appartement automatique.png", { type: "image/png" }),
    );
    return d;
  }, png);
  await page
    .locator(".plan-svg")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  await page
    .getByLabel("Surface intérieure totale", { exact: true })
    .fill("48");
  await page
    .getByRole("button", { name: "Créer mon appartement en 3D", exact: true })
    .click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("footer")).toContainText(
    "2 pièces · 48.0 m² · 0 meubles",
  );
  await expect(page.locator(".analysis-banner")).toContainText(
    "2 ouvertures à vérifier",
  );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/roomora-auto-3d.png" });
  await page.getByRole("button", { name: "Vérifier les ouvertures" }).click();
  await expect(page.getByLabel("Type de l’ouverture")).toHaveValue("window");
  await page.getByRole("button", { name: "Confirmer cette ouverture" }).click();
  await expect(page.locator(".analysis-banner")).toContainText(
    "1 ouvertures à vérifier",
  );
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("footer")).toContainText("2 pièces · 48.0 m²");
  await expect(page.locator(".analysis-banner")).toContainText(
    "1 ouvertures à vérifier",
  );
  expect(errors).toEqual([]);
});

test("une image non reconnue conserve le projet existant sans fabriquer de murs", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 100;
    const x = c.getContext("2d")!;
    x.fillStyle = "white";
    x.fillRect(0, 0, 100, 100);
    return c.toDataURL().split(",")[1];
  });
  await page
    .getByTitle("Créer automatiquement mon appartement depuis un plan")
    .click();
  await page.locator(".auto-import input[type=file]").setInputFiles({
    name: "Vide.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page
    .getByLabel("Surface intérieure totale", { exact: true })
    .fill("48");
  await page
    .getByRole("button", { name: "Créer mon appartement en 3D", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("contour");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page.locator("footer")).toContainText(
    "3 pièces · 48.0 m² · 5 meubles",
  );
});

test("un PDF vectoriel et la surface suffisent aussi à générer la 3D", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  const stream = "8 w 30 30 240 140 re S 150 30 m 150 170 l S";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 4 0 R >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf +=
    "xref\n0 5\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
      .join("") +
    `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await page
    .getByTitle("Créer automatiquement mon appartement depuis un plan")
    .click();
  await page.locator(".auto-import input[type=file]").setInputFiles({
    name: "Deux pièces.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdf),
  });
  await page
    .getByLabel("Surface intérieure totale", { exact: true })
    .fill("60");
  await page
    .getByRole("button", { name: "Créer mon appartement en 3D", exact: true })
    .click();
  await expect(page.locator(".analysis-banner")).toContainText("2 pièces", {
    timeout: 20000,
  });
  await expect(page.locator("footer")).toContainText("60.0 m²");
  await expect(page.locator("canvas")).toBeVisible();
});

test("placement et déplacement directs dans la vue 3D, rotation et visite réglable", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Appartement · 48/ }).click();
  await page
    .getByRole("button", { name: "Nouvel appartement", exact: true })
    .click();
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await canvas.screenshot();
  const box = await canvas.boundingBox();
  if (!box) throw Error("Canvas absent");
  const transfer = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.setData(
      "roomora-item",
      JSON.stringify({
        id: "test",
        name: "Table test",
        kind: "table",
        x: 0,
        y: 0,
        width: 1.6,
        depth: 0.9,
        height: 0.75,
        rotation: 0,
        color: "#ba9470",
      }),
    );
    return d;
  });
  await canvas.dispatchEvent("drop", {
    dataTransfer: transfer,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(
    "Table test",
  );
  const before = await page
    .getByLabel("Position X", { exact: true })
    .inputValue();
  // Project the tabletop center with the documented empty-project orbit camera.
  const { PerspectiveCamera, Vector3 } = await import("three");
  const camera = new PerspectiveCamera(42, box.width / box.height, 0.05, 500);
  camera.position.set(11.2, 7.6, 11.8);
  camera.lookAt(4, 0, 3);
  camera.updateMatrixWorld();
  const q = new Vector3(
    Number(before),
    0.73,
    Number(await page.getByLabel("Position Y", { exact: true }).inputValue()),
  ).project(camera);
  const x = box.x + ((q.x + 1) * box.width) / 2,
    y = box.y + ((1 - q.y) * box.height) / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 65, y + 15, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByLabel("Position X", { exact: true })).not.toHaveValue(
    before,
  );
  await page
    .getByTitle("Tourner de 15° vers la droite", { exact: true })
    .click();
  await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("15");
  await page.getByTitle("Annuler · ⌘Z").click();
  await expect(page.getByLabel("Rotation", { exact: true })).toHaveValue("0");
  await page.keyboard.press("h");
  await expect(
    page.getByRole("button", { name: "Hauteur · H", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowUp");
  await expect(
    page.getByLabel("Élévation au-dessus du sol", { exact: true }),
  ).toHaveValue("0.05");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(
    page.getByLabel("Élévation au-dessus du sol", { exact: true }),
  ).toHaveValue("0.06");
  const px = Number(
    await page.getByLabel("Position X", { exact: true }).inputValue(),
  );
  const py = Number(
    await page.getByLabel("Position Y", { exact: true }).inputValue(),
  );
  const heightBox = (await canvas.boundingBox())!;
  camera.aspect = heightBox.width / heightBox.height;
  camera.updateProjectionMatrix();
  const snapshot = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("roomora-camera-"),
    );
    return key ? JSON.parse(localStorage.getItem(key)!) : null;
  });
  if (snapshot) {
    camera.position.fromArray(snapshot.position);
    camera.lookAt(new Vector3(...snapshot.target));
    camera.updateMatrixWorld();
  }
  const raised = new Vector3(px, 0.79, py).project(camera);
  const hx = heightBox.x + ((raised.x + 1) * heightBox.width) / 2,
    hy = heightBox.y + ((1 - raised.y) * heightBox.height) / 2;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx, hy - 45, { steps: 10 });
  await page.mouse.up();
  await expect(
    page.getByLabel("Élévation au-dessus du sol", { exact: true }),
  ).not.toHaveValue("0.06");
  await expect(page.getByLabel("Position X", { exact: true })).toHaveValue(
    String(px),
  );
  await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue(
    String(py),
  );
  await page.getByTitle("Annuler · ⌘Z").click();
  await expect(
    page.getByLabel("Élévation au-dessus du sol", { exact: true }),
  ).toHaveValue("0.06");
  await page.keyboard.press("m");
  await expect(
    page.getByRole("button", { name: "Fixer au mur · M", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("m");
  await expect(
    page.getByRole("button", { name: "Au sol", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Visite", exact: true }).click();
  await page
    .getByLabel("Hauteur des yeux", { exact: true })
    .selectOption("1.4");
  await expect(page.getByLabel("Champ de vision", { exact: true })).toHaveValue(
    "72",
  );
  await expect(
    page.getByLabel("Vitesse de visite", { exact: true }),
  ).toBeVisible();
});

test("ZIP glTF texturé, rendu réaliste et parquet conservés dans la sauvegarde", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { zipSync, strToU8, unzipSync, strFromU8 } = await import("fflate");
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 2;
    const x = c.getContext("2d")!;
    x.fillStyle = "#367be0";
    x.fillRect(0, 0, 2, 2);
    return c.toDataURL().split(",")[1];
  });
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]);
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    buffers: [{ uri: "mesh.bin", byteLength: pos.byteLength }],
    bufferViews: [{ buffer: 0, byteLength: pos.byteLength }],
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
    images: [{ uri: "textures/fabric.png" }],
    textures: [{ source: 0 }],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.8,
        },
      },
    ],
  };
  const archive = zipSync({
    "meuble/scene.gltf": strToU8(JSON.stringify(gltf)),
    "meuble/mesh.bin": new Uint8Array(pos.buffer),
    "meuble/textures/fabric.png": new Uint8Array(Buffer.from(png, "base64")),
  });
  await page
    .getByRole("button", { name: "Ajouter mon propre meuble", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Sketchfab/ })).toBeVisible();
  await page.locator('input[accept=".glb,.gltf,.zip"]').setInputFiles({
    name: "Fauteuil-texture.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(archive),
  });
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(
    "Fauteuil-texture",
  );
  await expect(page.getByLabel("Style de rendu", { exact: true })).toHaveValue(
    "realistic",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByLabel("Style de rendu", { exact: true })
    .selectOption("standard");
  await page
    .getByLabel("Style de rendu", { exact: true })
    .selectOption("realistic");
  await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
  await page
    .locator(".plan-svg polygon")
    .first()
    .click({ position: { x: 40, y: 40 } });
  await page
    .getByRole("button", { name: "Parquet chêne naturel", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Parquet chêne naturel", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const c of stream!) chunks.push(c);
  const exported = unzipSync(Buffer.concat(chunks));
  const project = JSON.parse(strFromU8(exported["project.json"]));
  expect(project.rooms[0].finish).toBe("oak");
  const item = project.items.find(
    (i: { name: string }) => i.name === "Fauteuil-texture",
  );
  const saved = JSON.parse(strFromU8(exported["assets/" + item.asset]));
  expect(saved.images[0].uri).toContain("data:image/png;base64,");
  expect(saved.buffers[0].uri).toContain(
    "data:application/octet-stream;base64,",
  );
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  await page.screenshot({ path: "/tmp/roomora-realistic-floor.png" });
  expect(errors).toEqual([]);
});

test("importe un GLB Draco avec le décodeur fourni par Roomora", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  const decoded = page.waitForResponse(
    (r) => r.url().includes("/decoders/draco/draco_decoder.wasm") && r.ok(),
  );
  await page
    .locator('input[accept=".glb,.gltf,.zip"]')
    .setInputFiles("e2e/fixtures/draco-triangle.glb");
  await decoded;
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(
    "draco-triangle",
  );
  await expect(page.getByLabel("Largeur", { exact: true })).toHaveValue("1");
});

test("E masque et réaffiche les alertes sans modifier les meubles", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Canapé 2.2 × 0.9 m", exact: true })
    .click();
  await page.getByLabel("Largeur", { exact: true }).fill("10");
  const warning = page
    .locator(".warning")
    .filter({ hasText: "Chevauchement possible" });
  const toggle = page.getByRole("button", {
    name: "Alertes de chevauchement",
    exact: true,
  });
  await expect(warning).toBeVisible();
  await expect(
    page.locator('.plan-svg g[data-item] > rect[stroke="#d86a54"]').first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
  await page.keyboard.press("e");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(warning).toHaveCount(0);
  await expect(
    page.locator('.plan-svg g[data-item] > rect[stroke="#d86a54"]'),
  ).toHaveCount(0);
  await expect(page.getByLabel("Largeur", { exact: true })).toHaveValue("10");
  await page.getByLabel("Nom", { exact: true }).focus();
  await page.keyboard.press("e");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
  await page.keyboard.press("e");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(warning).toBeVisible();
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(warning).toHaveCount(0);
  await toggle.click();
  await expect(warning).toBeVisible();
});

test("navigation 3D : clic droit sûr, caméra conservée, vues et centrage", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Appartement · 48/ }).click();
  await page
    .getByRole("button", { name: "Nouvel appartement", exact: true })
    .click();
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  const canvas = page.locator("canvas");
  await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  const transfer = await page.evaluateHandle(() => {
    const d = new DataTransfer();
    d.setData(
      "roomora-item",
      JSON.stringify({
        id: "table",
        name: "Table navigation",
        kind: "table",
        x: 0,
        y: 0,
        width: 1.6,
        depth: 0.9,
        height: 0.75,
        rotation: 0,
        color: "#ba9470",
      }),
    );
    return d;
  });
  await canvas.dispatchEvent("drop", {
    dataTransfer: transfer,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(
    "Table navigation",
  );
  const before = [
    await page.getByLabel("Position X", { exact: true }).inputValue(),
    await page.getByLabel("Position Y", { exact: true }).inputValue(),
  ];
  const { PerspectiveCamera, Vector3 } = await import("three");
  const c = new PerspectiveCamera(42, box.width / box.height, 0.05, 500);
  c.position.set(11.2, 7.6, 11.8);
  c.lookAt(4, 0, 3);
  c.updateMatrixWorld();
  const q = new Vector3(Number(before[0]), 0.73, Number(before[1])).project(c),
    x = box.x + ((q.x + 1) * box.width) / 2,
    y = box.y + ((1 - q.y) * box.height) / 2;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(x + 70, y + 20, { steps: 12 });
  await page.mouse.up({ button: "right" });
  await expect(page.getByLabel("Position X", { exact: true })).toHaveValue(
    before[0],
  );
  await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue(
    before[1],
  );
  const snapshot = () =>
    page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) =>
        k.startsWith("roomora-camera-"),
      );
      return key ? JSON.parse(localStorage.getItem(key)!) : null;
    });
  await expect.poll(snapshot).not.toBeNull();
  const saved = await snapshot();
  c.position.fromArray(saved.position);
  c.lookAt(new Vector3(...saved.target));
  c.updateMatrixWorld();
  const clickPoint = new Vector3(
    Number(before[0]),
    0.73,
    Number(before[1]),
  ).project(c);
  const cx = box.x + ((clickPoint.x + 1) * box.width) / 2,
    cy = box.y + ((1 - clickPoint.y) * box.height) / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 1, cy + 1);
  await page.mouse.up();

  expect(
    saved.target.some(
      (n: number, i: number) => Math.abs(n - [4, 0, 3][i]) > 0.1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  await canvas.screenshot();
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.2 } });
  await page.waitForTimeout(250);
  const restored = await snapshot();
  for (let i = 0; i < 3; i++) {
    expect(restored.position[i]).toBeCloseTo(saved.position[i], 1);
    expect(restored.target[i]).toBeCloseTo(saved.target[i], 1);
  }
  await page.getByTitle("Annuler · ⌘Z").click();
  await expect(page.locator("footer")).toContainText("0 meubles");
  await page.getByTitle("Rétablir · ⌘⇧Z").click();
  await expect(page.locator("footer")).toContainText("1 meubles");
  await page.getByRole("button", { name: "Dessus", exact: true }).click();
  await expect
    .poll(async () => {
      const s = await snapshot();
      return (
        s.position[1] - s.target[1] >
        Math.hypot(s.position[0] - s.target[0], s.position[2] - s.target[2]) *
          10
      );
    })
    .toBe(true);
  await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
  await page.locator(".plan-svg g[data-item] > rect").click();
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  await page.keyboard.press("f");
  await expect
    .poll(async () => {
      const s = await snapshot();
      return (
        Math.abs(s.target[0] - Number(before[0])) +
        Math.abs(s.target[2] - Number(before[1]))
      );
    })
    .toBeLessThan(0.03);
  const zoomStart = await snapshot();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -200);
  await expect
    .poll(async () => {
      const v = await snapshot();
      return Math.hypot(
        v.target[0] - zoomStart.target[0],
        v.target[2] - zoomStart.target[2],
      );
    })
    .toBeGreaterThan(0.01);
  await page
    .getByRole("button", { name: "Déplacer la vue", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Déplacer la vue", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Aménager", exact: true }).click();
  await page.keyboard.down("Space");
  await expect(
    page.getByRole("button", { name: "Déplacer la vue", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.up("Space");
});

test("proportions, unités et dissociation d’un ensemble restent sauvegardables", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("./");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  const data = Buffer.from(
    new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 1]).buffer,
  );
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { name: "Fauteuil séparé", mesh: 0, translation: [-2, 0, 0] },
      { name: "Lampe séparée", mesh: 0, translation: [2, 1.5, 0] },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [
      {
        uri: "data:application/octet-stream;base64," + data.toString("base64"),
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
  await page.locator('input[accept=".glb,.gltf,.zip"]').setInputFiles({
    name: "ensemble.gltf",
    mimeType: "model/gltf+json",
    buffer: Buffer.from(JSON.stringify(gltf)),
  });
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue("ensemble");
  await expect(
    page.getByLabel("Conserver les proportions", { exact: true }),
  ).toBeChecked();
  await page.getByLabel("Largeur", { exact: true }).fill("500");
  await expect(page.getByLabel("Profondeur", { exact: true })).toHaveValue(
    "100",
  );
  await expect(page.getByLabel("Hauteur", { exact: true })).toHaveValue("250");
  await page
    .getByText("Corriger l’unité du fichier importé", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Interpréter le modèle en cm", exact: true })
    .click();
  await expect(page.getByLabel("Largeur", { exact: true })).toHaveValue("5");
  await expect(page.getByLabel("Profondeur", { exact: true })).toHaveValue("1");
  await page
    .getByLabel("Unité de saisie des dimensions", { exact: true })
    .selectOption("cm");
  await expect(page.getByLabel("Largeur", { exact: true })).toHaveValue("500");
  await page
    .getByLabel("Unité de saisie des dimensions", { exact: true })
    .selectOption("m");
  await page.getByLabel("Conserver les proportions", { exact: true }).uncheck();
  await page.getByLabel("Largeur", { exact: true }).fill("6");
  await expect(page.getByLabel("Profondeur", { exact: true })).toHaveValue("1");
  await page
    .getByRole("button", { name: "Atelier 3D · retirer le décor", exact: true })
    .click();
  await expect(
    page.getByText("Fauteuil séparé", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Garder Fauteuil séparé", exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Appliquer · garder 1 éléments", exact: true })
    .click();
  await expect(page.locator("footer")).toContainText("6 meubles");
  await page.getByTitle("Annuler · ⌘Z").click();
  await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
  await page.locator('g[data-item="true"]').last().click({ force: true });
  await page
    .getByRole("button", { name: "Atelier 3D · retirer le décor", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Garder Fauteuil séparé", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Dissocier ces 2 sous-objets", exact: true })
    .click();
  await expect(page.locator("footer")).toContainText("7 meubles");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  const d = await dl,
    stream = await d.createReadStream(),
    chunks = [];
  for await (const v of stream!) chunks.push(v);
  const { unzipSync, strFromU8 } = await import("fflate");
  const bytes = unzipSync(Buffer.concat(chunks));
  const p = JSON.parse(strFromU8(bytes["project.json"])),
    parts = p.items.filter(
      (i: { modelPart?: string }) => i.modelPart !== undefined,
    );
  expect(parts).toHaveLength(2);
  expect(parts[0].asset).toBe(parts[1].asset);
  expect(parts[1].elevation).toBeCloseTo(1.5);
  expect(parts[0].width).toBeCloseTo(1.2);
  expect(bytes["assets/" + parts[0].asset]).toBeTruthy();
  await page.getByTitle("Annuler · ⌘Z").click();
  await expect(page.locator("footer")).toContainText("6 meubles");
  await page.getByTitle("Rétablir · ⌘⇧Z").click();
  await expect(page.locator("footer")).toContainText("7 meubles");
  await page.locator('input[accept=".zip"]').setInputFiles({
    name: "restauration.zip",
    mimeType: "application/zip",
    buffer: Buffer.concat(chunks),
  });
  await expect(page.locator("footer")).toContainText("7 meubles");
  await page
    .getByRole("button", { name: /Appartement/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Stockage de ce navigateur",
      exact: true,
    }),
  ).toBeVisible();
});

test("un écran glisse sur un mur à la hauteur choisie et reste sauvegardé", async ({
  page,
}) => {
  const { blank, furniture, catalog } = await import("../src/model");
  const { zipSync, strToU8 } = await import("fflate");
  const p = blank();
  p.walls = [
    {
      id: "support",
      a: { x: 0, y: 0 },
      b: { x: 6, y: 0 },
      height: 2.6,
      thickness: 0.2,
      color: "#ffffff",
      openings: [],
    },
  ];
  p.items = [
    {
      ...furniture(catalog[0]),
      name: "Écran mural",
      kind: "tv",
      x: 3,
      y: 2,
      width: 1.2,
      depth: 0.08,
      height: 0.7,
    },
  ];
  await page.goto("./");
  await page.locator('input[accept=".zip"]').setInputFiles({
    name: "ecran.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(
      zipSync({ "project.json": strToU8(JSON.stringify(p)) }),
    ),
  });
  await expect(page.locator("footer")).toContainText("1 meubles");
  await page.locator('g[data-item="true"]').last().click({ force: true });
  await page.getByRole("button", { name: "Vue 3D", exact: true }).click();
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  const { PerspectiveCamera, Vector3 } = await import("three");
  // The wall spans x=0..6 and the object extends to z=2.04.
  const camera = new PerspectiveCamera(42, box.width / box.height, 0.05, 500);
  camera.position.set(3 + 6 * 0.9, 6 * 0.95, 1.02 + 6 * 1.1);
  camera.lookAt(3, 0, 1.02);
  camera.updateMatrixWorld();
  const point = (v: InstanceType<typeof Vector3>) => {
    const q = v.project(camera);
    return {
      x: box.x + ((q.x + 1) * box.width) / 2,
      y: box.y + ((1 - q.y) * box.height) / 2,
    };
  };
  await page.keyboard.press("m");
  const start = point(new Vector3(3, 0.4, 2)),
    end = point(new Vector3(3, 1.6, 0.1));
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 20 });
  await page.mouse.up();
  await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue(
    "0.145",
  );
  await expect(
    page.getByLabel("Élévation au-dessus du sol", { exact: true }),
  ).toHaveValue("1.25");
  await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Plan 2D", exact: true }).click();
  await page.locator('g[data-item="true"]').last().click({ force: true });
  await expect(
    page.getByLabel("Élévation au-dessus du sol", { exact: true }),
  ).toHaveValue("1.25");
});
