// A shared Supabase project must not share this app's cookies with other apps.
export function authCookieName(url: string) {
  return `toon-sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
}
export function authCookieOptions(url: string, siteUrl: string) {
  return {name:authCookieName(url),path:"/",sameSite:"lax" as const,secure:new URL(siteUrl).protocol === "https:"};
}
