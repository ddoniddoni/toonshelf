"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv, requireSupabaseEnv } from "@/lib/env/public";
import type { DatabaseContract } from "@/types/database.contract";
import { authCookieOptions } from "./cookies";

export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient<DatabaseContract>(url, key, {cookieOptions:authCookieOptions(url,getPublicEnv().siteUrl)});
}
