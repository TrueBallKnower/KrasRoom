import { mkdtempSync } from "node:fs";
import { defineConfig } from "@playwright/test";
const outDir = process.env.ROOMORA_CLOUD_TEST_BASE_URL
  ? ""
  : mkdtempSync("/tmp/roomora-cloud-test-");
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/cloud.flow.ts",
  workers: 1,
  use: {
    baseURL: process.env.ROOMORA_CLOUD_TEST_BASE_URL || "http://127.0.0.1:5180",
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
  webServer: process.env.ROOMORA_CLOUD_TEST_BASE_URL
    ? undefined
    : {
        command: `npm run build -- --outDir ${outDir} && npm run preview -- --outDir ${outDir} --port 5180 --host 127.0.0.1`,
        url: "http://127.0.0.1:5180",
        reuseExistingServer: false,
        env: {
          VITE_ROOMORA_DISABLE_CLOUD: "false",
          VITE_SUPABASE_URL: "https://roomora-test.supabase.co",
          VITE_SUPABASE_ANON_KEY: "sb_publishable_roomora_test_only",
        },
      },
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
});
