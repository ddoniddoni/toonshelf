import { parsePublicEnv, ConfigurationError } from "./schema";

export function getPublicEnv() {
  // Static references are necessary for Next.js browser env substitution.
  return parsePublicEnv({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function requireSupabaseEnv() {
  const { supabase } = getPublicEnv();
  if (!supabase) throw new ConfigurationError(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
  return supabase;
}
