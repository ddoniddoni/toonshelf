// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";

const mocks = vi.hoisted(() => ({
  env: null as null | { url: string; key: string },
  claims: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/env/public", () => ({ getPublicEnv: () => ({ supabase: mocks.env }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));
import { updateSession } from "@/lib/supabase/proxy";

describe("SSR response cookie adapter (not a live Auth test)", () => {
  beforeEach(() => { mocks.env = null; mocks.create.mockReset(); mocks.claims.mockReset(); });
  it("does not call Supabase for the unconfigured P0 preview", async () => {
    await updateSession(new NextRequest("http://localhost:3000/"));
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("preserves all cookies and cache headers after multiple cookie writes", async () => {
    mocks.env = { url: "http://127.0.0.1:55321", key: "sb_publishable_test_only" };
    mocks.create.mockImplementation((_url, _key, { cookies }: { cookies: CookieMethodsServer }) => {
      mocks.claims.mockImplementation(async () => {
        await cookies.setAll?.([{ name: "sb-test", value: "refreshed", options: { path: "/", sameSite: "lax" } }], { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" });
        await cookies.setAll?.([{ name: "sb-next", value: "second", options: { path: "/" } }], {});
        return { data: { claims: null }, error: null };
      });
      return { auth: { getClaims: mocks.claims } };
    });
    const request = new NextRequest("http://localhost:3000/");
    const response = await updateSession(request);
    expect(mocks.claims).toHaveBeenCalledOnce();
    expect(request.cookies.get("sb-test")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-test")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-next")?.value).toBe("second");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Expires")).toBe("0");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });
});
