import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "@/lib/env/schema";

const valid = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only" };
describe("configuration boundaries", () => {
  it("allows the P0 preview without pretending Supabase is configured", () => {
    expect(parsePublicEnv({}).supabase).toBeNull();
    expect(parseServerEnv({}).APP_ENV).toBe("local");
  });
  it("requires both Supabase values", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL })).toThrow("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });
  it("rejects privileged keys without exposing their values", () => {
    const secret = "sb_secret_never_print_this";
    try { parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret }); }
    catch (error) { expect(String(error)).not.toContain(secret); }
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret })).toThrow();
  });
  it("allows legacy local anon keys but rejects service-role JWTs", () => {
    const key = (role: string) => `e30.${btoa(JSON.stringify({ role }))}.test`;
    expect(parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key("anon") }).supabase).not.toBeNull();
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key("service_role") })).toThrow();
  });
  it.each(["staging", "production"])("requires remote HTTPS config in %s", (APP_ENV) => {
    expect(() => parseServerEnv({ ...valid, APP_ENV })).toThrow();
    expect(parseServerEnv({ APP_ENV, NEXT_PUBLIC_SITE_URL: "https://toonshelf.example", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valid.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }).APP_ENV).toBe(APP_ENV);
  });
  it("does not turn the string false into a true flag", () => {
    expect(parseServerEnv({ DEMO_MODE: "false" }).DEMO_MODE).toBe(false);
    expect(() => parseServerEnv({ DEMO_MODE: "yes" })).toThrow();
  });
  it("blocks demo data in a production build and adult catalogue everywhere", () => {
    expect(() => parseServerEnv({ NODE_ENV: "production", DEMO_MODE: "true" })).toThrow("DEMO_MODE");
    expect(() => parseServerEnv({ FEATURE_ADULT_CATALOGUE: "true" })).toThrow("FEATURE_ADULT_CATALOGUE");
  });
  it("rejects unsafe URL protocols", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" })).toThrow();
  });
});
