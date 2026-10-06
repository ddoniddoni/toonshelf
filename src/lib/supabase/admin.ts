import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "@/lib/env/public";
import { ConfigurationError } from "@/lib/env/schema";
import type { DatabaseContract } from "@/types/database.contract";

// Server-only registration, proof issuance and validated asset processing.
export function createAdminClient() {
  const {url} = requireSupabaseEnv();
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new ConfigurationError(["SUPABASE_SECRET_KEY"]);
  return createClient<DatabaseContract>(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
}
