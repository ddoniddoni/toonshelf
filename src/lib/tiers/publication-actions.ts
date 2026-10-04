"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { requireModerator } from "@/lib/reviews/moderation";
import { getPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { ConfigurationError } from "@/lib/env/schema";
import { checked,field } from "@/lib/auth/validation";
import { uuidSchema } from "@/lib/catalogue/model";
import { reportReasonSchema } from "@/lib/reviews/model";
import type { FormState } from "@/types/auth";
import { versionSchema } from "./model";
import { publicationError as tierError } from "./errors";
import { hashShareToken,issueShareToken,recoverShareToken } from "./share-token";
import { accessInputSchema,lifecycleInputSchema,publishInputSchema,publicationSchema,publicationStateSchema,revealInputSchema } from "./publication-model";

function shareError(error:unknown) {
 const result=actionError(error);
 return error instanceof ConfigurationError ? {...result,error:{...result.error,message:"공유 링크를 발급하거나 복구할 서버 설정이 필요해요."}} : result;
}

function invalidate(id:string) {
 revalidatePath("/u/[username]","page");
 revalidatePath("/tiers","layout");revalidatePath("/me/tiers","layout");revalidatePath("/share/t/[token]","page");
 revalidatePath(`/tiers/${id}/publish`);revalidatePath("/admin/tiers","layout");revalidatePath("/admin/tier-reports");revalidatePath("/me/tier-reports");
}
export async function publishTier(input:unknown) {
 try {
  const {client}=await requireAccount();const value=publishInputSchema.parse(input);
  const token=value.visibility === "unlisted" ? issueShareToken(value.id) : null;
  const {data,error}=await client.rpc("publish_tier_list",{p_id:value.id,p_draft_version:value.draftVersion,p_list_version:value.listVersion,
   p_fingerprint:value.fingerprint,p_visibility:value.visibility,p_spoiler:value.isSpoiler,p_token:token,p_confirm:true});
  tierError(error);const state=publicationStateSchema.parse(data);invalidate(value.id);return {ok:true as const,state};
 } catch(error) {return shareError(error);}
}
export async function withdrawTier(input:unknown) {
 try {
  const {client}=await requireAccount();const value=lifecycleInputSchema.parse(input);
  const {data,error}=await client.rpc("withdraw_tier_publication",{p_id:value.id,p_version:value.version,p_confirm:true});tierError(error);
  const state=publicationStateSchema.parse(data);invalidate(value.id);return {ok:true as const,state};
 } catch(error) {return actionError(error);}
}
export async function rotateTierLink(input:unknown) {
 try {
  const {client}=await requireAccount();const value=lifecycleInputSchema.parse(input);
  const {data,error}=await client.rpc("rotate_tier_share_token",{p_id:value.id,p_version:value.version,p_token:issueShareToken(value.id),p_confirm:true});tierError(error);
  const state=publicationStateSchema.parse(data);invalidate(value.id);return {ok:true as const,state};
 } catch(error) {return shareError(error);}
}
export async function getTierShareUrl(input:unknown) {
 try {
  const {client}=await requireAccount();const value=z.strictObject({id:uuidSchema,version:versionSchema}).parse(input);
  const {data,error}=await client.rpc("get_my_tier_share_token",{p_id:value.id,p_version:value.version});tierError(error);
  if (data === null) throw new AuthFailure("NOT_FOUND","사용 가능한 공유 링크가 없어요.");
  const token=recoverShareToken(value.id,data);return {ok:true as const,url:new URL(`/share/t/${token}`,getPublicEnv().siteUrl).href};
 } catch(error) {return shareError(error);}
}
export async function revealTier(input:unknown) {
 try {
  const value=revealInputSchema.parse(input);
  const {data,error}=await (await createClient()).rpc("get_tier_publication",{p_id:value.id,p_hash:value.token === null ? null : hashShareToken(value.token),p_reveal:true,p_version:value.version});tierError(error);
  if (data === null) throw new AuthFailure("NOT_FOUND","게시본을 더 이상 볼 수 없어요.");
  const publication=publicationSchema.parse(data);if (!publication.body) throw new AuthFailure("NOT_FOUND","게시본을 찾을 수 없어요.");
  return {ok:true as const,publication};
 } catch(error) {return actionError(error);}
}
export async function clonePublishedTier(_state:FormState,form:FormData):Promise<FormState> {
 let id:string;
 try {
  const {client}=await requireAccount();const value=accessInputSchema.extend({version:versionSchema,confirm:z.literal(true)}).parse({id:field(form,"id"),token:field(form,"token") || null,version:Number(field(form,"version")),confirm:checked(form,"confirm")});
  const {data,error}=await client.rpc("clone_tier_publication",{p_id:value.id,p_hash:value.token === null ? null : hashShareToken(value.token),p_version:value.version,p_confirm:true});tierError(error);id=uuidSchema.parse(data);
 } catch(error) {return actionError(error);}
 revalidatePath("/me/tiers");redirect(`/tiers/${id}/edit`);
}
export async function reportTier(_state:FormState,form:FormData):Promise<FormState> {
 try {
  const {client}=await requireAccount();const value=accessInputSchema.extend({reason:reportReasonSchema,detail:z.string().trim().refine(v=>Array.from(v).length >= 10 && Array.from(v).length <= 2000)}).parse({id:field(form,"id"),token:field(form,"token") || null,reason:field(form,"reason"),detail:field(form,"detail")});
  const {error}=await client.rpc("report_tier_publication",{p_id:value.id,p_hash:value.token === null ? null : hashShareToken(value.token),p_reason:value.reason,p_detail:value.detail});tierError(error);
 } catch(error) {return actionError(error);}
 revalidatePath("/me/tier-reports");redirect("/me/tier-reports?sent=1");
}
export async function moderateTier(_state:FormState,form:FormData):Promise<FormState> {
 let id:string;
 try {
  const {client}=await requireModerator();id=uuidSchema.parse(field(form,"id"));
  const version=versionSchema.parse(Number(field(form,"version"))),operation=z.enum(["hide","restore","reject_report"]).parse(field(form,"operation"));
  const report=field(form,"reportId"),reportId=report ? uuidSchema.parse(report) : null;
  const reason=z.string().trim().refine(v=>Array.from(v).length >= 2 && Array.from(v).length <= 1000).parse(field(form,"reason"));
  const result=z.string().trim().refine(v=>Array.from(v).length <= 500).parse(field(form,"result"));
  const {error}=await client.rpc("moderate_tier_publication",{p_id:id,p_version:version,p_action:operation,p_reason:reason,p_report:reportId,p_result:result});tierError(error);
 } catch(error) {return actionError(error);}
 invalidate(id);redirect(`/admin/tiers/${id}`);
}
