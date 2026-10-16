import { defineConfig } from "@playwright/test";
import base from "./playwright.cloud.config";
export default defineConfig({
  ...base,
  testMatch: "**/cloudStorage.flow.ts",
  use: { ...base.use, browserName: "webkit", launchOptions: {} },
});
