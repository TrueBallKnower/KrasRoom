import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
// In-memory fake service: never contacts real Supabase or sends real credentials.
export async function cloudTestService(browser: Browser, mobileB = false) {
  const owner = "a1111111-1111-4111-8111-111111111111",
    other = "b1111111-1111-4111-8111-111111111111",
    rows = new Map<string, any>(),
    files = new Map<string, Buffer>();
  const writes: Array<{ device: string; x: number; revision: string }> = [];
  let uploads = 0;
  const blocked = new Set<BrowserContext>();
  const reads = new Map<BrowserContext, number>();
  const a = await browser.newContext(),
    b = await browser.newContext(
      mobileB
        ? {
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
          }
        : {},
    ),
    c = await browser.newContext();
  async function transport(context: BrowserContext) {
    // Playwright WebKit interception omits multipart file contents (the route
    // receives an empty File). Buffer the actual encoded body in this fake
    // transport so the test server can inspect every byte. No app code changes.
    await context.addInitScript(() => {
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (
          url.startsWith("https://roomora-test.supabase.co/storage/") &&
          init?.body instanceof FormData
        ) {
          const encoded = new Response(init.body);
          const headers = new Headers(init.headers);
          headers.set("content-type", encoded.headers.get("content-type")!);
          return nativeFetch(input, {
            ...init,
            headers,
            body: await encoded.arrayBuffer(),
          });
        }
        return nativeFetch(input, init);
      };
    });
    await context.route(
      "https://roomora-test.supabase.co/**",
      async (route) => {
        if (blocked.has(context)) return route.abort("internetdisconnected");
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
            reads.set(context, (reads.get(context) || 0) + 1);
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
          writes.push({
            device: context === a ? "A" : context === b ? "B" : "C",
            x: body.document.project.items.at(-1)?.x,
            revision: body.revision,
          });
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
    await expect(page.locator(".saved")).toContainText("Enregistré", {
      timeout: 15000,
    });
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
  return {
    owner,
    other,
    rows,
    files,
    writes,
    blocked,
    reads,
    a,
    b,
    c,
    login,
    get uploads() {
      return uploads;
    },
  };
}
