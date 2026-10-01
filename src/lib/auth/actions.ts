"use server";

import { randomBytes } from "node:crypto";
import { createClient as createSdkClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicEnv, requireSupabaseEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import { registrationOpen } from "./config";
import { type FormState } from "@/types/auth";
import { AuthFailure, actionError, databaseError } from "./errors";
import { getCurrentAccount, memberDestination, requireAccount } from "./session";
import { consumeTicket, issueTicket, privateCookieOptions } from "./reauth";
import { checked, confirmationSchema, emailSchema, field, genreFields, newPasswordSchema, onboardingSchema, profileSchema, purposeSchema, safeReturnTo, settingsSchema, signInSchema, signUpSchema } from "./validation";

type Outcome = {message?: string; redirectTo?: string};
async function run(operation: () => Promise<Outcome>): Promise<FormState> {
  let result: Outcome;
  try { result = await operation(); } catch (error) { return actionError(error); }
  if (result.redirectTo) { revalidatePath("/", "layout"); redirect(result.redirectTo); }
  return {ok:true,data:{message:result.message ?? "저장했어요."}};
}
function authError(error: {code?: string} | null, message: string) {
  if (!error) return;
  const limited = error.code?.includes("rate_limit") || error.code === "over_request_rate_limit";
  throw new AuthFailure(limited ? "RATE_LIMITED" : "VALIDATION_ERROR",limited ? "잠시 후 다시 시도해 주세요. 메일은 최소 60초 간격으로 요청할 수 있어요." : message);
}
function isolatedAuth() {
  const {url,key} = requireSupabaseEnv();
  return createSdkClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});
}
const consents = (form: FormData) => ({terms:checked(form,"terms"),privacy:checked(form,"privacy"),age14:checked(form,"age14")});
function assertRegistrationOpen() {
  if (!registrationOpen()) throw new AuthFailure("CONFIG_REQUIRED", "현재 신규 가입을 준비하고 있어요.");
}
export async function signUp(_previous: FormState, form: FormData) {
  return run(async () => {
    assertRegistrationOpen();
    const input = signUpSchema.parse({email:field(form,"email").trim(),password:field(form,"password"),confirmPassword:field(form,"confirmPassword"),...consents(form)});
    const client = await createClient();
    const {error} = await client.auth.signUp({email:input.email,password:input.password,options:{emailRedirectTo:`${getPublicEnv().siteUrl}/auth/confirm`}});
    authError(error,"가입 요청을 처리하지 못했어요. 입력 내용과 이메일을 확인해 주세요.");
    // No email/user/password is put in a redirect URL or in action state.
    return {redirectTo:"/auth/check-email"};
  });
}
export async function signIn(_previous: FormState, form: FormData) {
  if (form.has("provider")) return signInWithOAuth(_previous,form);
  return run(async () => {
    const input = signInSchema.parse({email:field(form,"email").trim(),password:field(form,"password")});
    const client = await createClient();
    const {error} = await client.auth.signInWithPassword(input);
    authError(error,"이메일 또는 비밀번호를 확인해 주세요.");
    return {redirectTo:await memberDestination(field(form,"returnTo"))};
  });
}
export async function signOut() {
  return run(async () => {
    const client = await createClient();
    const {data:{user},error:userError} = await client.auth.getUser();
    if (userError && userError.name !== "AuthSessionMissingError" && userError.status !== 401 && userError.status !== 403) throw new AuthFailure("INTERNAL_ERROR","계정을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    const store = await cookies();
    for (const cookie of store.getAll()) if (cookie.name.startsWith("ts-reauth-") || cookie.name === "ts-oauth") store.delete(cookie.name);
    if (!user) {
      // Only clear this request's default Supabase auth cookie/chunks.
      const name = `sb-${new URL(requireSupabaseEnv().url).hostname.split(".")[0]}-auth-token`;
      for (const cookie of store.getAll()) if (cookie.name === name || cookie.name.startsWith(`${name}.`)) store.delete(cookie.name);
      return {redirectTo:"/auth/sign-in"};
    }
    const {error} = await client.auth.signOut({scope:"local"});
    authError(error,"로그아웃하지 못했어요. 다시 시도해 주세요.");
    return {redirectTo:"/auth/sign-in"};
  });
}
export async function resendEmail(_previous: FormState, form: FormData) {
  return run(async () => {
    const email = emailSchema.parse(field(form,"email").trim());
    const {error} = await (await createClient()).auth.resend({type:"signup",email,options:{emailRedirectTo:`${getPublicEnv().siteUrl}/auth/confirm`}});
    // Account enumeration is avoided for success, missing accounts and provider errors.
    if (error?.code?.includes("rate_limit")) authError(error,"");
    return {message:"인증이 필요한 계정이면 확인 메일을 보냈어요. 받은편지함과 스팸함을 확인해 주세요."};
  });
}
export async function requestRecovery(_previous: FormState, form: FormData) {
  return run(async () => {
    const email = emailSchema.parse(field(form,"email").trim());
    await (await createClient()).auth.resetPasswordForEmail(email,{redirectTo:`${getPublicEnv().siteUrl}/auth/confirm`});
    return {message:"해당 이메일로 복구할 수 있는 계정이 있으면 안내 메일을 보냈어요. 잠시 후 받은편지함과 스팸함을 확인해 주세요."};
  });
}
export async function confirmEmail(_previous: FormState, form: FormData) {
  return run(async () => {
    const input = confirmationSchema.parse({tokenHash:field(form,"tokenHash"),type:field(form,"type")});
    // Check required server configuration BEFORE consuming a recovery token.
    if (input.type === "recovery") createAdminClient();
    const {error} = await (await createClient()).auth.verifyOtp({token_hash:input.tokenHash,type:input.type});
    authError(error,"이 링크가 만료되었거나 이미 사용됐어요. 새 메일을 요청해 주세요.");
    if (input.type === "recovery") { await issueTicket("password_reset"); return {redirectTo:"/auth/reset-password"}; }
    return {redirectTo:await memberDestination(input.type === "email_change" ? "/settings/account" : field(form,"returnTo"))};
  });
}
export async function resetPassword(_previous: FormState, form: FormData) {
  return run(async () => {
    const input = newPasswordSchema.parse({password:field(form,"password"),confirmPassword:field(form,"confirmPassword"),nonce:field(form,"nonce") || undefined});
    const account = await consumeTicket("password_reset");
    const {error} = await account.client.auth.updateUser({password:input.password,nonce:input.nonce});
    authError(error,"비밀번호를 변경하지 못했어요. 새 복구 메일로 다시 진행해 주세요. 추가 확인 코드가 필요하면 메일 코드를 먼저 요청해 주세요.");
    return {redirectTo:await memberDestination("/me/library")};
  });
}
// Public authentication entry point; does not write account data or issue reauth.
async function signInWithOAuth(_previous: FormState, form: FormData) {
  return run(async () => {
    assertRegistrationOpen();
    const provider = z.enum(["google","kakao"]).parse(field(form,"provider"));
    const env = getServerEnv();
    if (!(provider === "google" ? env.AUTH_GOOGLE_ENABLED : env.AUTH_KAKAO_ENABLED)) throw new AuthFailure("CONFIG_REQUIRED", "이 로그인 방법은 아직 준비 중이에요.");
    const nonce = randomBytes(32).toString("base64url");
    const returnTo = safeReturnTo(field(form,"returnTo"));
    (await cookies()).set("ts-oauth",JSON.stringify({nonce,returnTo,expiresAt:Date.now()+600000}),privateCookieOptions());
    const callback = new URL("/auth/callback",getPublicEnv().siteUrl);
    callback.searchParams.set("flow",nonce);
    const {data,error} = await (await createClient()).auth.signInWithOAuth({provider,options:{redirectTo:callback.toString(),skipBrowserRedirect:true}});
    authError(error,"외부 로그인에 연결하지 못했어요. 다시 시도해 주세요.");
    const url = data.url ? new URL(data.url) : null;
    if (!url || url.origin !== new URL(requireSupabaseEnv().url).origin || url.pathname !== "/auth/v1/authorize") throw new AuthFailure("INTERNAL_ERROR", "로그인 주소를 확인할 수 없어요.");
    return {redirectTo:url.toString()};
  });
}
export async function completeOnboarding(_previous: FormState, form: FormData) {
  return run(async () => {
    const input = onboardingSchema.parse({username:field(form,"username"),displayName:field(form,"displayName"),bio:field(form,"bio"),library:field(form,"library"),evaluation:field(form,"evaluation"),genres:genreFields(form),policyVersion:field(form,"policyVersion"),...consents(form)});
    const account = await requireAccount(false);
    const {error} = await account.client.rpc("complete_onboarding",{p_username:input.username,p_display_name:input.displayName,p_bio:input.bio,p_library:input.library,p_evaluation:input.evaluation,p_genres:input.genres,p_policy_version:input.policyVersion,p_terms:input.terms,p_privacy:input.privacy,p_age_14:input.age14});
    databaseError(error);
    return {redirectTo:safeReturnTo(field(form,"returnTo"))};
  });
}
export async function saveProfile(_previous: FormState, form: FormData) {
  return run(async () => {
    const input = profileSchema.parse({displayName:field(form,"displayName"),bio:field(form,"bio"),discoveryOptIn:checked(form,"discoveryOptIn")});
    const {client} = await requireAccount();
    const {error} = await client.rpc("save_profile",{p_display_name:input.displayName,p_bio:input.bio,p_discovery_opt_in:input.discoveryOptIn});
    databaseError(error); revalidatePath("/", "layout");
    return {message:"프로필을 저장했어요."};
  });
}
export async function saveSettings(_previous: FormState, form: FormData) {
  return run(async () => {
    const input = settingsSchema.parse({library:field(form,"library"),evaluation:field(form,"evaluation"),theme:field(form,"theme"),timezone:field(form,"timezone"),genres:genreFields(form),notifications:{followers:checked(form,"followers"),replies:checked(form,"replies"),reactions:checked(form,"reactions"),announcements:checked(form,"announcements")}});
    const {client} = await requireAccount();
    const {error} = await client.rpc("save_settings",{p_library:input.library,p_evaluation:input.evaluation,p_theme:input.theme,p_timezone:input.timezone,p_genres:input.genres,p_notifications:input.notifications});
    databaseError(error); revalidatePath("/", "layout");
    return {message:"설정을 저장했어요. 기본 공개 범위는 앞으로 추가하는 기록에 적용돼요."};
  });
}
export async function sendReauthOtp() {
  return run(async () => {
    createAdminClient();
    const account = await requireAccount();
    const {error:rateError} = await account.client.rpc("reserve_account_request",{p_action:"reauth_email"}); databaseError(rateError);
    const {error} = await isolatedAuth().auth.signInWithOtp({email:account.user.email!,options:{shouldCreateUser:false}});
    authError(error,"확인 코드를 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
    return {message:"현재 계정 이메일로 확인 코드를 보냈어요. 아래에 코드를 입력해 주세요."};
  });
}
export async function reauthenticate(_previous: FormState, form: FormData) {
  return run(async () => {
    createAdminClient();
    const purpose = purposeSchema.exclude(["password_reset"]).parse(field(form,"purpose"));
    const method = z.enum(["password","otp"]).parse(field(form,"method"));
    const account = await requireAccount();
    const {error:rateError} = await account.client.rpc("reserve_account_request",{p_action:"reauth_verify"}); databaseError(rateError);
    const auth = isolatedAuth();
    let verifiedUserId: string | undefined;
    if (method === "password") {
      if (!account.user.identities?.some((i) => i.provider === "email")) throw new AuthFailure("VALIDATION_ERROR", "이메일 확인 코드를 사용해 주세요.");
      const password = z.string().min(1).max(512).parse(field(form,"currentPassword"));
      const {data,error} = await auth.auth.signInWithPassword({email:account.user.email!,password});
      authError(error,"현재 비밀번호를 확인해 주세요."); verifiedUserId = data.user?.id;
    } else {
      const token = z.string().regex(/^\d{6}$/).parse(field(form,"otp"));
      const {data,error} = await auth.auth.verifyOtp({email:account.user.email!,token,type:"email"});
      authError(error,"확인 코드가 만료되었거나 올바르지 않아요."); verifiedUserId = data.user?.id;
    }
    await auth.auth.signOut({scope:"local"});
    if (verifiedUserId !== account.user.id) throw new AuthFailure("FORBIDDEN", "같은 계정으로 다시 확인해 주세요.");
    await issueTicket(purpose);
    return {message:"계정을 확인했어요. 10분 안에 선택한 변경을 진행해 주세요."};
  });
}
export async function requestPasswordNonce() {
  return run(async () => {
    const account = await requireAccount(false);
    const {error:rateError} = await account.client.rpc("reserve_account_request",{p_action:"password_nonce"}); databaseError(rateError);
    const {error} = await account.client.auth.reauthenticate();
    authError(error,"비밀번호 변경 확인 코드를 보내지 못했어요.");
    return {message:"메일로 추가 확인 코드를 보냈어요. 비밀번호 입력란 아래에 코드를 입력해 주세요."};
  });
}
export async function changePassword(_previous: FormState, form: FormData) {
  return run(async () => {
    const input = newPasswordSchema.parse({password:field(form,"password"),confirmPassword:field(form,"confirmPassword"),nonce:field(form,"nonce") || undefined});
    const account = await consumeTicket("password_change");
    const {error} = await account.client.auth.updateUser({password:input.password,nonce:input.nonce});
    authError(error,"변경하지 못했어요. 추가 확인 코드가 필요한 경우 코드를 요청한 뒤 재인증하고 다시 시도해 주세요.");
    return {message:"비밀번호를 변경했어요."};
  });
}
export async function changeEmail(_previous: FormState, form: FormData) {
  return run(async () => {
    const email = emailSchema.parse(field(form,"email").trim());
    const account = await consumeTicket("email_change");
    const {error} = await account.client.auth.updateUser({email},{emailRedirectTo:`${getPublicEnv().siteUrl}/auth/confirm`});
    authError(error,"이메일 변경을 요청하지 못했어요. 재인증한 뒤 다시 시도해 주세요.");
    return {message:"현재 주소와 새 주소의 확인 메일을 확인해 주세요. 모든 확인을 마치기 전까지 기존 주소를 사용해요."};
  });
}
export async function setContactEmail(_previous: FormState, form: FormData) {
  return run(async () => {
    const account = await getCurrentAccount();
    if (!account || account.access.status !== "pending" || account.user.email) throw new AuthFailure("FORBIDDEN", "기존 주소의 인증 메일을 확인해 주세요.");
    const email = emailSchema.parse(field(form,"email").trim());
    const {error} = await account.client.auth.updateUser({email},{emailRedirectTo:`${getPublicEnv().siteUrl}/auth/confirm`});
    authError(error,"연락 이메일을 등록하지 못했어요. 다시 시도해 주세요.");
    return {message:"입력한 이메일의 확인 메일을 열어 주세요. 확인 전에는 프로필을 저장할 수 없어요."};
  });
}
