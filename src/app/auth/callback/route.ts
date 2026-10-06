import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { memberDestination } from "@/lib/auth/session";
import { safeReturnTo } from "@/lib/auth/validation";
import { registrationOpen } from "@/lib/auth/config";

export const dynamic = "force-dynamic";
const flowSchema = z.object({nonce:z.string().regex(/^[A-Za-z0-9_-]{43}$/),returnTo:z.string().max(512),expiresAt:z.number()});
export async function GET(request: NextRequest) {
  const site = getPublicEnv().siteUrl;
  let destination = "/auth/sign-in?error=oauth";
  const store = await cookies();
  const stored = store.get("ts-oauth")?.value;
  store.delete("ts-oauth");
  try {
    const flow = flowSchema.parse(stored ? JSON.parse(stored) : null);
    const nonce = request.nextUrl.searchParams.get("flow") ?? "";
    const code = request.nextUrl.searchParams.get("code");
    const expected = Buffer.from(flow.nonce); const actual = Buffer.from(nonce);
    if (actual.length === expected.length && timingSafeEqual(expected,actual) && flow.expiresAt > Date.now() && code && code.length <= 2048 && !request.nextUrl.searchParams.has("error")) {
      const client = await createClient();
      const {error} = await client.auth.exchangeCodeForSession(code);
      if (!error && registrationOpen()) {
        const {error:enrollmentError} = await client.rpc("toon_enroll_current_account");
        if (!enrollmentError) destination = await memberDestination(safeReturnTo(flow.returnTo));
      }
    }
  } catch { /* Never log OAuth code, provider responses, or cookies. */ }
  const response = NextResponse.redirect(new URL(destination,site));
  response.headers.set("Cache-Control","private, no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  return response;
}
