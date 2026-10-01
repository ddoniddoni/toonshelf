import { parsePublicEnv } from "./schema";

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
  if (!supabase) throw new Error("Supabase 설정이 필요합니다. .env.local의 공개 URL과 공개 키를 설정해 주세요.");
  return supabase;
}
