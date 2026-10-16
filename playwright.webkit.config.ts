import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: "**/mobile.e2e.ts",
  grep: /téléphone :/,
  use: {
    ...base.use,
    browserName: "webkit",
    // Chromium's GPU and sandbox switches do not apply to WebKit.
    launchOptions: {},
  },
});
