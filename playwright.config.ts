import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    baseURL: process.env.ROOMORA_TEST_BASE_URL || "http://127.0.0.1:5173",
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: process.env.ROOMORA_TEST_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 5173",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
      },
  workers: 1,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
});
