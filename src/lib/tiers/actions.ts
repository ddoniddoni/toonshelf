"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { field,checked } from "@/lib/auth/validation";
import { uuidSchema } from "@/lib/catalogue/model";
import type { FormState } from "@/types/auth";
import { defaultDraft,draftSchema,editorSchema,pickerInputSchema,pickerSchema,saveInputSchema,saveReplySchema,versionSchema,type SaveReply } from "./model";
import { tierError } from "./errors";
export async function createTierDraft(_state:FormState,form:FormData):Promise<FormState> {
 let id:string;
 try {
  const {client}=await requireAccount();const draft=draftSchema.parse({...defaultDraft(randomUUID),title:field(form,"title").trim()});
  const {data,error}=await client.rpc("toon_create_tier_draft",{p_draft:draft,p_origin:null});tierError(error);id=uuidSchema.parse(data);
 } catch(error) {return actionError(error);}
 revalidatePath("/me/tiers");redirect(`/tiers/${id}/edit`);
}
export async function copyTierDraft(_state:FormState,form:FormData):Promise<FormState> {
 let id:string;
 try {const {client}=await requireAccount();const {data,error}=await client.rpc("toon_copy_tier_draft",{p_id:uuidSchema.parse(field(form,"id")),p_version:versionSchema.parse(Number(field(form,"version")))});tierError(error);id=uuidSchema.parse(data);}
 catch(error) {return actionError(error);}
 revalidatePath("/me/tiers");redirect(`/tiers/${id}/edit`);
}
export async function deleteTierDraft(_state:FormState,form:FormData):Promise<FormState> {
 try {
  const {client}=await requireAccount();if (!checked(form,"confirm")) throw new AuthFailure("VALIDATION_ERROR","초안 삭제에 동의해 주세요.");
  const {error}=await client.rpc("toon_delete_tier_draft",{p_id:uuidSchema.parse(field(form,"id")),p_version:versionSchema.parse(Number(field(form,"version"))),p_confirm:true});tierError(error);
 } catch(error) {return actionError(error);}
 revalidatePath("/u/[username]","page");revalidatePath("/me/tiers");revalidatePath("/tiers","layout");revalidatePath("/share/t/[token]","page");redirect("/me/tiers?deleted=1");
}
export async function saveTierDraft(input:unknown):Promise<SaveReply> {
 try {
  const {client}=await requireAccount();const value=saveInputSchema.parse(input);
  const {data,error}=await client.rpc("toon_save_tier_draft",{p_id:value.tierListId,p_version:value.expectedVersion,p_draft:value.draft});tierError(error);
  const reply=saveReplySchema.parse(data);
  if (!reply.ok) return {...reply,error:{code:"CONFLICT",message:"다른 화면이나 작품 병합으로 초안이 바뀌었어요. 최신 초안을 불러오거나 새 티어표로 저장해 주세요."}};
  revalidatePath("/me/tiers");return reply;
 } catch(error) {return actionError(error);}
}
export async function reloadTierDraft(id:unknown) {
 try {const {client}=await requireAccount();const {data,error}=await client.rpc("toon_get_my_tier_editor",{p_id:uuidSchema.parse(id)});tierError(error);if (data === null) throw new AuthFailure("NOT_FOUND","티어 초안을 찾을 수 없어요.");return {ok:true as const,data:editorSchema.parse(data)};}
 catch(error) {return actionError(error);}
}
export async function saveTierAsNew(input:unknown) {
 try {
  const {client}=await requireAccount();const value=z.strictObject({origin:uuidSchema,draft:draftSchema}).parse(input);
  const {data,error}=await client.rpc("toon_create_tier_draft",{p_draft:value.draft,p_origin:value.origin});tierError(error);revalidatePath("/me/tiers");return {ok:true as const,id:uuidSchema.parse(data)};
 } catch(error) {return actionError(error);}
}
export async function searchTierWorks(input:unknown) {
 try {
  const {client}=await requireAccount();const value=pickerInputSchema.parse(input);
  const {data,error}=await client.rpc("toon_search_tier_draft_works",{p_origin:value.origin,p_q:value.q,p_page:value.page});tierError(error);return {ok:true as const,data:pickerSchema.parse(data)};
 } catch(error) {return actionError(error);}
}
