import { z } from "zod";

const optionalText = z.preprocess((value) => value === "" ? undefined : value, z.string().optional());
const httpUrl = z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol));
const optionalUrl = z.preprocess((value) => value === "" ? undefined : value, httpUrl.optional());

export class ConfigurationError extends Error {
  constructor(fields: string[]) {
    super(`환경변수를 확인해 주세요: ${[...new Set(fields)].join(", ")}`);
    this.name = "ConfigurationError";
  }
}

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: httpUrl.default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalText,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalText,
});

export function parsePublicEnv(input: Record<string, string | undefined>) {
  const result = publicSchema.safeParse(input);
  if (!result.success) throw new ConfigurationError(result.error.issues.map((issue) => String(issue.path[0])));
  const { NEXT_PUBLIC_SUPABASE_URL: url } = result.data;
  const key = result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? result.data.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (Boolean(url) !== Boolean(key)) {
    throw new ConfigurationError(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
  }
  // Reject privileged keys before they can reach a browser bundle/client.
  for (const name of ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const) {
    if (result.data[name] && !isPublicKey(result.data[name])) throw new ConfigurationError([name]);
  }
  return { siteUrl: result.data.NEXT_PUBLIC_SITE_URL, supabase: url && key ? { url, key } : null };
}

function isPublicKey(key: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  // Local CLI versions may still supply a legacy anon JWT. This is key hygiene,
  // not JWT authentication; only Supabase verifies signed user identities.
  try {
    const payload = key.split(".")[1];
    return key.split(".").length === 3 && JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role === "anon";
  } catch { return false; }
}

const flag = z.enum(["true", "false"]).default("false").transform((value) => value === "true");
const serverSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  AUTH_GOOGLE_ENABLED: flag,
  AUTH_KAKAO_ENABLED: flag,
  AUTH_REGISTRATION_ENABLED: flag,
  FEATURE_ADULT_CATALOGUE: z.literal("false").default("false"),
  DEMO_MODE: flag,
});

export function parseServerEnv(input: Record<string, string | undefined>) {
  const result = serverSchema.safeParse(input);
  if (!result.success) throw new ConfigurationError(result.error.issues.map((issue) => String(issue.path[0])));
  const publicEnv = parsePublicEnv(input);
  const flags = result.data;
  if (flags.DEMO_MODE && (flags.APP_ENV !== "local" || input.NODE_ENV === "production")) {
    throw new ConfigurationError(["DEMO_MODE"]);
  }
  if (flags.APP_ENV !== "local") {
    const site = new URL(publicEnv.siteUrl);
    const database = publicEnv.supabase ? new URL(publicEnv.supabase.url) : null;
    if (site.protocol !== "https:" || isLoopback(site.hostname)) throw new ConfigurationError(["NEXT_PUBLIC_SITE_URL"]);
    if (!database || database.protocol !== "https:" || isLoopback(database.hostname)) {
      throw new ConfigurationError(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
    }
  }
  if ((flags.AUTH_GOOGLE_ENABLED || flags.AUTH_KAKAO_ENABLED) && !publicEnv.supabase) {
    throw new ConfigurationError(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
  }
  return { ...publicEnv, ...flags };
}

function isLoopback(hostname: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}
