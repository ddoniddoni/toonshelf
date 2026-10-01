import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { accessSchema, safeReturnTo, sessionIdSchema } from "./validation";
import { AuthFailure, databaseError } from "./errors";

export const getCurrentAccount = cache(async () => {
  if (!getPublicEnv().supabase) return null;
  const client = await createClient();
  const { data: {user}, error } = await client.auth.getUser();
  if (error || !user) return null;
  const {data: claims, error: claimsError} = await client.auth.getClaims();
  const session = sessionIdSchema.safeParse(claims?.claims.session_id);
  if (claimsError || !session.success || claims?.claims.sub !== user.id) throw new AuthFailure("AUTH_REQUIRED", "다시 로그인해 주세요.");
  const {data, error: accessError} = await client.rpc("get_my_access");
  databaseError(accessError);
  const access = accessSchema.parse(data);
  return {client,user,sessionId:session.data,access};
});
export async function requireAccount(active = true) {
  const account = await getCurrentAccount();
  if (!account) throw new AuthFailure("AUTH_REQUIRED", "로그인이 필요해요.");
  if (account.access.status === "suspended" || account.access.status === "deleting") throw new AuthFailure("FORBIDDEN", "현재 계정으로는 이 작업을 진행할 수 없어요.");
  if (!account.user.email || !account.user.email_confirmed_at) throw new AuthFailure("EMAIL_UNVERIFIED", "먼저 이메일 주소를 확인해 주세요.");
  if (active && (account.access.status !== "active" || !account.access.consents_current)) throw new AuthFailure("ONBOARDING_REQUIRED", "프로필 설정과 필수 동의를 완료해 주세요.");
  return account;
}
export async function memberDestination(returnTo: unknown) {
  const account = await getCurrentAccount();
  const destination = safeReturnTo(returnTo);
  if (!account) return `/auth/sign-in?returnTo=${encodeURIComponent(destination)}`;
  if (!account.user.email || !account.user.email_confirmed_at) return "/auth/check-email";
  if (account.access.status === "suspended" || account.access.status === "deleting") return "/auth/account-status";
  if (account.access.status !== "active" || !account.access.consents_current) return `/onboarding?returnTo=${encodeURIComponent(destination)}`;
  return destination;
}
export async function guardPage(path: string, allowPending = false) {
  if (!getPublicEnv().supabase) return null;
  const destination = await memberDestination(path);
  if (allowPending && destination.startsWith("/onboarding")) return requireAccount(false);
  if (destination !== path) redirect(destination);
  return requireAccount();
}
