import { test, expect, type BrowserContext, type Page } from "@playwright/test";
// Deterministic fake transport only: never sends credentials or files to a real service.
test("deux navigateurs retrouvent les meubles et les modifications, sans écraser une version concurrente (service simulé)", async ({
  browser,
}) => {
  test.setTimeout(90000);
  const owner = "a1111111-1111-4111-8111-111111111111",
    other = "b1111111-1111-4111-8111-111111111111",
    rows = new Map<string, any>(),
    files = new Map<string, Buffer>();
  let uploads = 0;
  const a = await browser.newContext(),
    b = await browser.newContext(),
    c = await browser.newContext();
  async function transport(context: BrowserContext) {
    await context.route(
      "https://roomora-test.supabase.co/**",
      async (route) => {
        const request = route.request(),
          url = new URL(request.url()),
          method = request.method();
        const headers = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            "authorization,apikey,content-type,x-client-info,prefer,x-upsert,x-supabase-api-version",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "content-type": "application/json",
        };
        const reply = (body: unknown, status = 200) =>
          route.fulfill({ status, headers, body: JSON.stringify(body) });
        if (method === "OPTIONS")
          return route.fulfill({ status: 204, headers });
        if (url.pathname === "/auth/v1/token") {
          const credentials = request.postDataJSON(),
            id = credentials.email === "other@example.com" ? other : owner,
            user = {
              id,
              email: credentials.email,
              aud: "authenticated",
              role: "authenticated",
              created_at: new Date().toISOString(),
            };
          const enc = (v: unknown) =>
              Buffer.from(JSON.stringify(v)).toString("base64url"),
            token =
              enc({ alg: "HS256", typ: "JWT" }) +
              "." +
              enc({
                sub: id,
                exp: Math.floor(Date.now() / 1000) + 3600,
                role: "authenticated",
              }) +
              ".test-signature";
          return reply({
            access_token: token,
            refresh_token: "test-refresh-" + id,
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: "bearer",
            user,
          });
        }
        const auth = request.headers().authorization || "",
          jwt = auth.replace("Bearer ", "").split(".")[1];
        let user = "";
        try {
          user = JSON.parse(Buffer.from(jwt, "base64url").toString()).sub;
        } catch {}
        if (url.pathname === "/auth/v1/logout")
          return route.fulfill({ status: 204, headers });
        if (url.pathname === "/auth/v1/user")
          return reply({
            id: user,
            email: "person@example.com",
            aud: "authenticated",
            role: "authenticated",
          });
        if (!user) return reply({ message: "unauthorized" }, 401);
        if (url.pathname === "/rest/v1/roomora_projects") {
          const id = url.searchParams.get("project_id")?.replace(/^eq\./, ""),
            revision = url.searchParams.get("revision")?.replace(/^eq\./, "");
          if (method === "GET") {
            const data = [...rows.values()].filter(
              (r) => r.owner_id === user && (!id || r.project_id === id),
            );
            return reply(
              request.headers().accept?.includes("vnd.pgrst.object")
                ? data[0]
                : data,
            );
          }
          const body = request.postDataJSON();
          if (body.owner_id !== user)
            return reply({ message: "forbidden" }, 403);
          const key = user + "/" + body.project_id,
            old = rows.get(key);
          if (method === "POST" && old)
            return reply({ code: "23505", message: "duplicate" }, 409);
          if (method === "PATCH" && (!old || old.revision !== revision))
            return reply([]);
          rows.set(key, { ...body, updated_at: new Date().toISOString() });
          return reply([{ revision: body.revision }]);
        }
        if (url.pathname.startsWith("/storage/v1/object/")) {
          const path = decodeURIComponent(
            url.pathname.replace(
              /^\/storage\/v1\/object\/(authenticated\/)?roomora-private\//,
              "",
            ),
          );
          if (!path.startsWith(user + "/"))
            return reply({ message: "forbidden" }, 403);
          if (method === "POST") {
            if (files.has(path))
              return reply(
                { statusCode: "409", message: "already exists" },
                409,
              );
            const form = await new Response(request.postDataBuffer(), {
              headers: { "content-type": request.headers()["content-type"] },
            }).formData();
            const file = form.get("") as File;
            files.set(path, Buffer.from(await file.arrayBuffer()));
            uploads++;
            return reply({ Key: "roomora-private/" + path });
          }
          const file = files.get(path);
          if (!file) return reply({ message: "missing" }, 404);
          return route.fulfill({
            headers: { ...headers, "content-type": "application/octet-stream" },
            body: file,
          });
        }
        return reply({ message: "unexpected endpoint " + url.pathname }, 400);
      },
    );
  }
  await Promise.all([transport(a), transport(b), transport(c)]);
  async function login(page: Page, email = "person@example.com") {
    await page.goto(
      process.env.ROOMORA_CLOUD_TEST_BASE_URL || "http://127.0.0.1:5180/",
    );
    await expect(page.getByText("Enregistré", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mon compte", exact: true }).click();
    await page.getByLabel("Adresse e-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill("test-password-only");
    await page
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await expect(page.getByText("Connecté :")).toBeVisible();
  }
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
    expect(uploads).toBe(1);
    const first = [...rows.values()][0],
      id = first.project_id;
    await login(pb);
    await expect(pb.locator(".modal .project-list button")).toHaveCount(1);
    await pb.locator(".modal .project-list button").click();
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
    expect(uploads).toBe(1);
    // Device A still has its earlier revision. Its save must be rejected.
    await pa
      .getByRole("button", {
        name: "Sauvegarder cet appartement en ligne",
        exact: true,
      })
      .click();
    await expect(pa.getByRole("alert")).toContainText(
      "Une autre version existe en ligne",
    );
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
    expect(item.x).toBe(2.5);
    expect(strFromU8(zip["assets/" + item.asset])).toContain(
      binary.toString("base64"),
    );
  } finally {
    await a.close();
    await b.close();
    await c.close();
  }
});
