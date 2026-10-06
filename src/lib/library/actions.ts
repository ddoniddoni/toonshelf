"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { checked,field } from "@/lib/auth/validation";
import { uuidSchema } from "@/lib/catalogue/model";
import type { FormState } from "@/types/auth";
import { libraryError } from "./errors";
import { recordPayloadSchema,selectionSchema,versionSchema } from "./model";
async function finish(operation:()=>Promise<string>):Promise<FormState> {
 let path:string;
 try { path = await operation(); } catch(error) { return actionError(error); }
 revalidatePath("/me/library");revalidatePath("/me/library/[workId]","page");revalidatePath("/works/[slug]","page");revalidatePath("/u/[username]","page");revalidatePath("/settings/privacy");
 redirect(path);
}
const nullableInteger = (value:string) => value === "" ? null : /^0$|^[1-9][0-9]*$/.test(value) ? Number(value) : NaN;
export async function saveReadingRecord(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();const id = uuidSchema.parse(field(form,"workId"));
  const versionValue = field(form,"version");const version = versionValue ? versionSchema.parse(nullableInteger(versionValue)) : null;
  const payload = recordPayloadSchema.parse({status:field(form,"status"),libraryVisibility:field(form,"libraryVisibility"),evaluationVisibility:field(form,"evaluationVisibility"),
   ratingSteps:nullableInteger(field(form,"ratingSteps")),canonicalTier:field(form,"canonicalTier") || null,episode:nullableInteger(field(form,"episode")),
   startedOn:field(form,"startedOn") || null,finishedOn:field(form,"finishedOn") || null,note:field(form,"note"),
   tags:field(form,"tags").split(/\r?\n/).map(t=>t.trim()).filter(Boolean),preferredLink:field(form,"preferredLink") || null});
  const {error} = await client.rpc("toon_save_reading_record",{p_work:id,p_expected_version:version,p_payload:payload,p_clear_evaluation:checked(form,"clearEvaluation")});
  libraryError(error);return "/me/library/"+id+"?saved=1";
 });
}
export async function copyWorkToLibrary(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();const id = uuidSchema.parse(field(form,"workId"));
  const {error} = await client.rpc("toon_copy_work_to_library",{p_work:id});libraryError(error);return "/me/library/"+id;
 });
}
export async function bulkLibraryChange(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();
  const raw = form.getAll("selection");
  if (raw.length > 100) throw new AuthFailure("VALIDATION_ERROR","한 번에 최대 100개 작품을 선택해 주세요.");
  const selection = selectionSchema.parse(raw.map(value=>{
   const entry = z.string().max(80).parse(value).split(":");
   if (entry.length !== 2) throw new AuthFailure("VALIDATION_ERROR","선택한 기록을 확인해 주세요.");
   return {id:entry[0],version:nullableInteger(entry[1])};
  }));
  const operation = z.enum(["delete","status","libraryVisibility","evaluationVisibility","tag"]).parse(field(form,"operation"));
  const value = field(form,"value").trim();const confirm = checked(form,"confirm");
  if (operation === "delete" && !confirm) throw new AuthFailure("VALIDATION_ERROR","개인 기록과 평가 삭제 범위를 확인하고 동의해 주세요.");
  const {error} = await client.rpc("toon_bulk_library_change",{p_selection:selection,p_operation:operation,p_value:value,p_confirm:confirm});
  libraryError(error);return "/me/library?changed=1";
 });
}
export async function makeAllLibraryPrivate(_state:FormState,form:FormData):Promise<FormState> {
 return finish(async()=>{
  const {client} = await requireAccount();
  if (!checked(form,"confirm")) throw new AuthFailure("VALIDATION_ERROR","모든 기록·평가와 새 기록 기본값을 비공개로 바꿀지 확인해 주세요.");
  const {error} = await client.rpc("toon_make_all_library_private",{p_confirm:true});libraryError(error);return "/me/library?private=1";
 });
}
