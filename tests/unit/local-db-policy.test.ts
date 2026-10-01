import { describe, expect, it } from "vitest";
import { assertLocalDatabase } from "../../scripts/local-db-policy.mjs";

describe("local-only DB guard (F11)", () => {
  const run = (env: Record<string, string> = {}, args: string[] = [], linked = false) => assertLocalDatabase({ env, args, linked });
  it("allows loopback-only local environments", () => {
    expect(() => run({ APP_ENV: "local", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321" })).not.toThrow();
  });
  it.each(["staging", "production"])("rejects %s", (APP_ENV) => expect(() => run({ APP_ENV })).toThrow());
  it("rejects passthrough flags, linked projects and remote environment variables", () => {
    expect(() => run({}, ["--linked"])).toThrow();
    expect(() => run({}, [], true)).toThrow();
    expect(() => run({ SUPABASE_PROJECT_REF: "remote" })).toThrow();
    expect(() => run({ SUPABASE_DB_URL: "postgres://remote" })).toThrow();
  });
  it.each(["https://localhost.attacker.test", "https://127.0.0.1.attacker.test", "https://localhost@remote.example", "https://remote.supabase.co"])("rejects non-loopback %s", (NEXT_PUBLIC_SUPABASE_URL) => {
    expect(() => run({ NEXT_PUBLIC_SUPABASE_URL })).toThrow();
  });
});
