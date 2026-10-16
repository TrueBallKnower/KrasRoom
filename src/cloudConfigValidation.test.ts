import { describe, it, expect } from "vitest";
import { isPublicCloudKey, validCloudUrl } from "./cloudConfigValidation";
describe("Configuration publique du stockage", () => {
  it("autorise seulement les clés Publishable et anon", () => {
    const jwt = (role: string) =>
      "test." + btoa(JSON.stringify({ role })) + ".test";
    expect(isPublicCloudKey("sb_publishable_test_only")).toBe(true);
    expect(isPublicCloudKey(jwt("anon"))).toBe(true);
    expect(isPublicCloudKey(jwt("service_role"))).toBe(false);
    expect(isPublicCloudKey(jwt("authenticated"))).toBe(false);
    expect(isPublicCloudKey("sb_secret_test_only")).toBe(false);
    expect(isPublicCloudKey("password")).toBe(false);
  });
  it("refuse une URL non HTTPS ou contenant des identifiants", () => {
    expect(validCloudUrl("https://test.supabase.co")).toBe(true);
    expect(validCloudUrl("http://test.supabase.co")).toBe(false);
    expect(validCloudUrl("https://login:password@test.supabase.co")).toBe(
      false,
    );
    expect(validCloudUrl("https://test.supabase.co/?key=anything")).toBe(false);
  });
});
