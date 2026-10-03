"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { checked,field } from "@/lib/auth/validation";
import type { FormState } from "@/types/auth";
import { catalogueAdminAccount } from "./admin";
import { catalogueOptions } from "./data";
import { catalogueError } from "./errors";
import { canonicalOfficialUrl,reasonSchema,sourceUrlSchema,suggestionSchema,uuidSchema,workPayloadSchema } from "./model";
import { mergePolicySchema } from "./merge-model";

const lines = (value:string) => value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
function dateField(form:FormData,name:string) { return z.iso.date().parse(field(form,name))+"T00:00:00Z"; }
function canonicalSource(value:string) {
  try { return sourceUrlSchema.parse(new URL(value.trim()).href); }
  catch { throw new AuthFailure("VALIDATION_ERROR","출처는 공개 가능한 HTTPS 주소로 입력해 주세요."); }
}
async function finish(operation:()=>Promise<string>):Promise<FormState> {
  let destination:string;
  try { destination = await operation(); } catch(error) { return actionError(error); }
  revalidatePath("/explore");revalidatePath("/works","layout");revalidatePath("/admin","layout");
  redirect(destination);
}
export async function upsertWork(_state:FormState,form:FormData):Promise<FormState> {
  return finish(async()=>{
    const {client} = await catalogueAdminAccount();
    const options = await catalogueOptions();
    if (!options) throw new AuthFailure("CONFIG_REQUIRED","카탈로그 연결 설정이 필요해요.");
    if (!checked(form,"originalDescription")) throw new AuthFailure("VALIDATION_ERROR","소개문을 직접 작성했는지 확인해 주세요.");
    const creatorCount = z.coerce.number().int().min(0).max(20).parse(field(form,"creatorCount"));
    const linkCount = z.coerce.number().int().min(1).max(20).parse(field(form,"linkCount"));
    const creators = Array.from({length:creatorCount},(_,index)=>{
      const prefix = "creator."+index+".";
      return {id:field(form,prefix+"id") || null,name:field(form,prefix+"name").trim(),aliases:lines(field(form,prefix+"aliases")).sort(),role:field(form,prefix+"role"),order:index};
    });
    const links = Array.from({length:linkCount},(_,index)=>{
      const prefix = "link."+index+".";
      const platform = options.platforms.find(p=>p.id === field(form,prefix+"platformId"));
      if (!platform) throw new AuthFailure("VALIDATION_ERROR","플랫폼을 선택해 주세요.");
      let url:string;
      try { url = canonicalOfficialUrl(field(form,prefix+"url"),platform); }
      catch { throw new AuthFailure("VALIDATION_ERROR","공식 링크는 선택한 플랫폼의 HTTPS 주소여야 해요."); }
      const dayValues = form.getAll(prefix+"weekdays");
      return {platformId:platform.id,url,externalId:field(form,prefix+"externalId").trim() || null,
        weekdays:dayValues.map(v=>typeof v === "string" && /^[0-6]$/.test(v)?Number(v):NaN),
        serialStatus:field(form,prefix+"serialStatus"),ageRating:field(form,prefix+"ageRating"),verifiedAt:dateField(form,prefix+"verifiedAt"),active:checked(form,prefix+"active")};
    });
    const payload = workPayloadSchema.parse({
      slug:field(form,"slug").trim(),title:field(form,"title").trim(),aliases:lines(field(form,"aliases")),description:field(form,"description").trim(),
      serialStatus:field(form,"serialStatus"),ageRating:field(form,"ageRating"),catalogueStatus:field(form,"catalogueStatus"),
      creators,genreIds:form.getAll("genreIds"),links,
      source:{url:canonicalSource(field(form,"sourceUrl")),fields:form.getAll("sourceFields"),verifiedAt:dateField(form,"sourceVerifiedAt"),note:field(form,"sourceNote").trim()}
    });
    const id = field(form,"id") ? uuidSchema.parse(field(form,"id")) : null;
    const version = id ? z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(field(form,"version")) : null;
    const reason = reasonSchema.parse(field(form,"reason").trim());
    const {data,error} = await client.rpc("admin_upsert_work",{p_id:id,p_expected_version:version,p_payload:payload,p_reason:reason});
    catalogueError(error);
    return "/admin/works/"+uuidSchema.parse(data)+"/edit?saved=1";
  });
}
export async function submitSuggestion(_state:FormState,form:FormData):Promise<FormState> {
  return finish(async()=>{
    const {client} = await requireAccount();
    const input = suggestionSchema.parse({kind:field(form,"kind"),workId:field(form,"workId") || null,proposal:field(form,"proposal").trim(),sourceUrl:canonicalSource(field(form,"sourceUrl"))});
    const {error} = await client.rpc("submit_catalogue_suggestion",{p_kind:input.kind,p_work_id:input.workId,p_proposal:input.proposal,p_source_url:input.sourceUrl});
    catalogueError(error);
    return "/submissions?sent=1";
  });
}
export async function reviewSuggestion(_state:FormState,form:FormData):Promise<FormState> {
  return finish(async()=>{
    const {client} = await catalogueAdminAccount();
    const id = uuidSchema.parse(field(form,"id"));
    const status = z.enum(["accepted","rejected"]).parse(field(form,"status"));
    const note = reasonSchema.parse(field(form,"note").trim());
    const workId = field(form,"resultWorkId") ? uuidSchema.parse(field(form,"resultWorkId")) : null;
    const {error} = await client.rpc("admin_review_submission",{p_id:id,p_status:status,p_note:note,p_work_id:workId});
    catalogueError(error);
    revalidatePath("/submissions");
    return "/admin/submissions?reviewed=1";
  });
}
export async function mergeWorks(_state:FormState,form:FormData):Promise<FormState> {
  return finish(async()=>{
    const {client} = await catalogueAdminAccount();
    const source = uuidSchema.parse(field(form,"sourceId"));const target = uuidSchema.parse(field(form,"targetId"));
    if (source === target) throw new AuthFailure("VALIDATION_ERROR","서로 다른 두 작품을 선택해 주세요.");
    const version = (name:string)=>z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(field(form,name));
    const reason = reasonSchema.parse(field(form,"reason").trim());
    if (!checked(form,"confirm") || !checked(form,"confirmPolicy")) throw new AuthFailure("VALIDATION_ERROR","같은 웹툰인지와 개인 기록 보존 정책을 확인해 주세요.");
    const {error} = await client.rpc("admin_merge_works",{p_source:source,p_target:target,p_source_version:version("sourceVersion"),
      p_target_version:version("targetVersion"),p_reason:reason,p_confirm:true,
      p_preview_token:uuidSchema.parse(field(form,"previewToken")),p_conflict_policy:mergePolicySchema.parse(field(form,"conflictPolicy"))});
    catalogueError(error);
    revalidatePath("/");revalidatePath("/me","layout");revalidatePath("/u/[username]","layout");revalidatePath("/reviews","layout");
    return "/admin/works/"+target+"/edit?merged=1";
  });
}
