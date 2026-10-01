import "server-only";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
export function registrationOpen() {
  const env = getServerEnv(); const database = getPublicEnv().supabase;
  const local = database && ["localhost","127.0.0.1","[::1]"].includes(new URL(database.url).hostname);
  return Boolean((env.APP_ENV === "local" && local) || env.AUTH_REGISTRATION_ENABLED);
}
