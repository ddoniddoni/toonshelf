import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv } from "@/lib/env/public";
import { requireAccount } from "./session";
import { type ReauthPurpose } from "./validation";
import { AuthFailure, databaseError } from "./errors";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const ticketCookie = (purpose: ReauthPurpose) => `ts-reauth-${purpose}`;
export const privateCookieOptions = () => ({httpOnly:true,secure:new URL(getPublicEnv().siteUrl).protocol === "https:",sameSite:"lax" as const,path:"/",maxAge:600});
export async function issueTicket(purpose: ReauthPurpose) {
  const account = await requireAccount(purpose !== "password_reset");
  const token = randomBytes(32).toString("base64url");
  const {error} = await createAdminClient().rpc("issue_reauth_ticket",{p_user_id:account.user.id,p_session_id:account.sessionId,p_token_hash:hashToken(token),p_purpose:purpose});
  databaseError(error);
  (await cookies()).set(ticketCookie(purpose),token,privateCookieOptions());
}
export async function consumeTicket(purpose: ReauthPurpose) {
  const account = await requireAccount(purpose !== "password_reset");
  const store = await cookies();
  const token = store.get(ticketCookie(purpose))?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AuthFailure("FORBIDDEN", "새 확인 링크 또는 재인증으로 다시 진행해 주세요.");
  const {error} = await account.client.rpc("consume_reauth_ticket",{p_token_hash:hashToken(token),p_purpose:purpose});
  databaseError(error);
  store.delete(ticketCookie(purpose));
  return account;
}
