"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "@/lib/env/public";
import type { DatabaseContract } from "@/types/database.contract";

export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient<DatabaseContract>(url, key);
}
