"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { field,checked } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import { requireModerator } from "@/lib/reviews/moderation";
import { moderationInputSchema } from "@/lib/reviews/model";
import { uuidSchema } from "@/lib/catalogue/model";
import { searchWorks } from "@/lib/catalogue/data";
import { versionSchema } from "@/lib/library/model";
import type { FormState } from "@/types/auth";
import { draftPayloadSchema,postDetailSchema,moderationSchema,reportInputSchema,type PostContentResult,type WorkSearchResult } from "./model";
import { postError } from "./errors";
function version(form:FormData,key:string) {return z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(versionSchema).parse(field(form,key));}
function consent(form:FormData) {if(!checked(form,"confirm"))throw new AuthFailure("VALIDATION_ERROR","작업 내용을 확인하고 동의해 주세요.");}
async function finish(operation:()=>Promise<string>):Promise<FormState> {
 let path:string;try{path=await operation();}catch(error){return actionError(error);}
 revalidatePath("/me/notifications");revalidatePath("/community","layout");revalidatePath("/posts","layout");revalidatePath("/me/posts","layout");revalidatePath("/me/feed");revalidatePath("/me/post-reports");revalidatePath("/admin/post-reports");revalidatePath("/admin/posts","layout");redirect(path);
}
export async function createPost(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{const {client}=await requireAccount();const id=uuidSchema.parse(field(form,"id"));const {data,error}=await client.rpc("toon_create_post_draft",{p_id:id});postError(error);return `/me/posts/${uuidSchema.parse(data)}/edit`;});
}
export async function savePostDraft(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{const {client}=await requireAccount();const id=uuidSchema.parse(field(form,"id"));
  const payload=draftPayloadSchema.parse({title:field(form,"title"),body:field(form,"body"),category:field(form,"category"),isSpoiler:checked(form,"isSpoiler"),workIds:form.getAll("workId")});
  const {error}=await client.rpc("toon_save_post_draft",{p_id:id,p_version:version(form,"draftVersion"),p_payload:payload});postError(error);return `/me/posts/${id}/edit?saved=1`;
 });
}
export async function publishPost(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{const {client}=await requireAccount();consent(form);const id=uuidSchema.parse(field(form,"id"));
  const {error}=await client.rpc("toon_publish_post",{p_id:id,p_draft_version:version(form,"draftVersion"),p_post_version:version(form,"postVersion")});postError(error);return `/posts/${id}`;
 });
}
export async function withdrawPost(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{const {client}=await requireAccount();consent(form);const id=uuidSchema.parse(field(form,"id"));const remove=z.enum(["unpublish","delete"]).parse(field(form,"operation"))==="delete";
  const {error}=await client.rpc("toon_withdraw_post",{p_id:id,p_version:version(form,"postVersion"),p_delete:remove,p_confirm:true});postError(error);return remove ? "/me/posts?deleted=1" : `/me/posts/${id}/edit?unpublished=1`;
 });
}
export async function reportPost(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{const {client}=await requireAccount();const v=reportInputSchema.parse({postId:field(form,"postId"),reason:field(form,"reason"),detail:field(form,"detail").trim()});
  const {error}=await client.rpc("toon_report_post",{p_post:v.postId,p_reason:v.reason,p_detail:v.detail});postError(error);return "/me/post-reports?sent=1";
 });
}
export async function moderatePost(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{const {client}=await requireModerator();const v=moderationInputSchema.parse({reviewId:field(form,"postId"),version:version(form,"postVersion"),action:field(form,"operation"),reason:field(form,"reason").trim(),reportId:field(form,"reportId")||null,result:field(form,"result").trim()});
  const {error}=await client.rpc("toon_moderate_post",{p_post:v.reviewId,p_version:v.version,p_action:v.action,p_reason:v.reason,p_report:v.reportId,p_result:v.result});postError(error);return `/admin/posts/${v.reviewId}?saved=1`;
 });
}
export async function revealPost(_state:PostContentResult|null,form:FormData):Promise<PostContentResult> {
 try{consent(form);const {data,error}=await (await createClient()).rpc("toon_get_post",{p_id:uuidSchema.parse(field(form,"id")),p_reveal:true,p_expected_version:version(form,"version")});postError(error);
  const value=data===null ? null : postDetailSchema.parse(data);if(!value || value.title===null || value.body===null)throw new AuthFailure("NOT_FOUND","지금 열람할 수 없는 글이에요.");return {ok:true,title:value.title,body:value.body,works:value.works};
 }catch(error){return {ok:false,message:actionError(error).error.message};}
}
export async function revealPostModeration(_state:PostContentResult|null,form:FormData):Promise<PostContentResult> {
 try{const {client}=await requireModerator();consent(form);const {data,error}=await client.rpc("toon_moderation_post_snapshot",{p_id:uuidSchema.parse(field(form,"id")),p_reveal:true,p_expected_version:version(form,"version")});postError(error);
  const value=data===null ? null : moderationSchema.parse(data);if(!value || value.title===null || value.body===null)throw new AuthFailure("NOT_FOUND","현재 검토할 수 있는 게시본이 없어요.");return {ok:true,title:value.title,body:value.body,works:[]};
 }catch(error){return {ok:false,message:actionError(error).error.message};}
}
export async function searchPostWorks(query:string):Promise<WorkSearchResult> {
 try{await requireAccount();const q=z.string().trim().min(2).max(100).parse(query);const result=await searchWorks({q,platform:[],genre:[],status:null,day:[],age:null,sort:"title"},undefined,10);
  return {ok:true,items:result.items.map(w=>({id:w.id,title:w.title,slug:w.slug}))};
 }catch(error){return {ok:false,message:actionError(error).error.message};}
}
