"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { checked,field } from "@/lib/auth/validation";
import { uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "@/lib/library/model";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/types/auth";
import { requireModerator } from "./moderation";
import { reviewError } from "./errors";
import { draftPayloadSchema,moderationInputSchema,moderationSchema,reportInputSchema,reviewDetailSchema,type BodyResult } from "./model";
function invalidate() {
 revalidatePath("/reviews","layout");revalidatePath("/me/reviews","layout");revalidatePath("/works/[slug]","page");revalidatePath("/u/[username]","page");
 revalidatePath("/me/reports");revalidatePath("/admin/reports");revalidatePath("/admin/reviews","layout");
}
async function finish(operation:()=>Promise<string>):Promise<FormState> {
 let path:string;try {path = await operation();}catch(error){return actionError(error);}
 invalidate();redirect(path);
}
function version(form:FormData,key:string) {return z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(versionSchema).parse(field(form,key));}
function consent(form:FormData) {if(!checked(form,"confirm")) throw new AuthFailure("VALIDATION_ERROR","작업 내용을 확인하고 동의해 주세요.");}
export async function createReview(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();const work = uuidSchema.parse(field(form,"workId"));
  const {data,error} = await client.rpc("toon_create_review_draft",{p_work:work});reviewError(error);return "/me/reviews/"+uuidSchema.parse(data)+"/edit";
 });
}
export async function saveReviewDraft(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();const id = uuidSchema.parse(field(form,"id"));const expected = version(form,"draftVersion");
  const episode = field(form,"episode");const payload = draftPayloadSchema.parse({body:field(form,"body"),isSpoiler:checked(form,"isSpoiler"),episode:episode === "" ? null : /^0$|^[1-9][0-9]*$/.test(episode) ? Number(episode) : NaN});
  const {error} = await client.rpc("toon_save_review_draft",{p_id:id,p_version:expected,p_payload:payload});reviewError(error);return "/me/reviews/"+id+"/edit?saved=1";
 });
}
export async function publishReview(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();consent(form);const id = uuidSchema.parse(field(form,"id"));
  const {error} = await client.rpc("toon_publish_review",{p_id:id,p_draft_version:version(form,"draftVersion"),p_review_version:version(form,"reviewVersion")});
  reviewError(error);return "/reviews/"+id;
 });
}
export async function withdrawReview(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();consent(form);const id = uuidSchema.parse(field(form,"id"));
  const operation = z.enum(["unpublish","delete"]).parse(field(form,"operation"));
  const {error} = await client.rpc("toon_withdraw_review",{p_id:id,p_version:version(form,"reviewVersion"),p_delete:operation === "delete",p_confirm:true});
  reviewError(error);return operation === "delete" ? "/me/reviews?deleted=1" : "/me/reviews/"+id+"/edit?unpublished=1";
 });
}
export async function reportReview(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();const input = reportInputSchema.parse({reviewId:field(form,"reviewId"),reason:field(form,"reason"),detail:field(form,"detail").trim()});
  const {error} = await client.rpc("toon_report_review",{p_review:input.reviewId,p_reason:input.reason,p_detail:input.detail});reviewError(error);return "/me/reports?sent=1";
 });
}
export async function setUserBlock(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();consent(form);
  const target = uuidSchema.parse(field(form,"userId"));const blocked = z.enum(["true","false"]).parse(field(form,"blocked")) === "true";
  const {error} = await client.rpc("toon_set_user_block",{p_user:target,p_blocked:blocked});reviewError(error);
  revalidatePath("/settings/blocks");revalidatePath("/me/library");revalidatePath("/tiers","layout");revalidatePath("/share/t/[token]","page");return "/settings/blocks?updated=1";
 });
}
export async function moderateReview(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireModerator();const input = moderationInputSchema.parse({reviewId:field(form,"reviewId"),version:version(form,"reviewVersion"),
   action:field(form,"operation"),reason:field(form,"reason").trim(),reportId:field(form,"reportId") || null,result:field(form,"result").trim()});
  const {error} = await client.rpc("toon_moderate_review",{p_review:input.reviewId,p_version:input.version,p_action:input.action,p_reason:input.reason,p_report:input.reportId,p_result:input.result});
  reviewError(error);return "/admin/reviews/"+input.reviewId+"?saved=1";
 });
}
// Public read action: no mutation and no session requirement. Permission is
// checked again in the RPC, including current blocks/work/status/version.
export async function revealReviewBody(_state:BodyResult|null,form:FormData):Promise<BodyResult> {
 try {
  consent(form);const id = uuidSchema.parse(field(form,"id"));const expected = version(form,"version");
  const {data,error} = await (await createClient()).rpc("toon_get_review",{p_id:id,p_reveal:true,p_expected_version:expected});reviewError(error);
  if (data === null) throw new AuthFailure("NOT_FOUND","지금 열람할 수 없는 리뷰예요.");
  const body = reviewDetailSchema.parse(data).body;if(body === null) throw new AuthFailure("NOT_FOUND","본문을 열지 못했어요.");return {ok:true,body};
 }catch(error){return {ok:false,message:actionError(error).error.message};}
}
export async function revealModerationBody(_state:BodyResult|null,form:FormData):Promise<BodyResult> {
 try {
  const {client} = await requireModerator();consent(form);
  const {data,error} = await client.rpc("toon_moderation_review_snapshot",{p_id:uuidSchema.parse(field(form,"id")),p_reveal:true,p_expected_version:version(form,"version")});reviewError(error);
  if(data === null) throw new AuthFailure("NOT_FOUND","리뷰를 확인할 수 없어요.");const body = moderationSchema.parse(data).body;
  if(body === null) throw new AuthFailure("NOT_FOUND","현재 게시된 검토 가능한 본문이 없어요.");return {ok:true,body};
 }catch(error){return {ok:false,message:actionError(error).error.message};}
}
