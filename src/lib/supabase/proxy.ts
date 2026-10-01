import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env/public";

export async function updateSession(request: NextRequest) {
  const { supabase: env } = getPublicEnv();
  let response = NextResponse.next({ request });
  // P0's public preview works without credentials; client creation fails closed.
  if (!env) return response;
  response.headers.set("Cache-Control", "private, no-store");
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousCookies = response.cookies.getAll();
        const previousHeaders = response.headers;
        response = NextResponse.next({ request });
        for (const key of ["Cache-Control", "Expires", "Pragma"]) {
          const value = previousHeaders.get(key);
          if (value) response.headers.set(key, value);
        }
        previousCookies.forEach((cookie) => response.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await supabase.auth.getClaims();
  // This only refreshes sessions. P1 must add DAL/RPC/RLS authorization.
  return response;
}
