"use server";

import sharp from "sharp";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { checked,field } from "@/lib/auth/validation";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/types/auth";
import { catalogueAdminAccount } from "./admin";
import { catalogueError } from "./errors";
import { licenseSchema,reasonSchema,uuidSchema } from "./model";

const stagedSchema = z.object({id:uuidSchema,path:z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/)});
function refreshCatalogue() { revalidatePath("/explore");revalidatePath("/works","layout");revalidatePath("/admin/assets"); }
export async function uploadCover(_state:FormState,form:FormData):Promise<FormState> {
  let staged:z.infer<typeof stagedSchema>|undefined;
  let account:Awaited<ReturnType<typeof catalogueAdminAccount>>|undefined;
  let storage:ReturnType<typeof createAdminClient>|undefined;
  try {
    account = await catalogueAdminAccount();storage = createAdminClient();
    const workId = uuidSchema.parse(field(form,"workId"));const reason = reasonSchema.parse(field(form,"reason").trim());
    const input = licenseSchema.parse({
      rightsHolder:field(form,"rightsHolder").trim(),evidence:field(form,"evidence").trim(),
      display:checked(form,"display"),og:checked(form,"og"),export:checked(form,"export"),commercial:checked(form,"commercial"),
      attribution:field(form,"attribution").trim(),validFrom:z.iso.date().parse(field(form,"validFrom"))+"T00:00:00Z",
      expiresAt:field(form,"expiresAt") ? z.iso.date().parse(field(form,"expiresAt"))+"T00:00:00Z" : null
    });
    const file = form.get("cover");
    if (!(file instanceof File) || file.size < 1 || file.size > 2097152 || !["image/jpeg","image/png","image/webp"].includes(file.type)) throw new AuthFailure("VALIDATION_ERROR","JPEG·PNG·WebP 파일을 2MB 이하로 선택해 주세요.");
    const inputBytes = Buffer.from(await file.arrayBuffer());
    const signatureMatches = file.type === "image/jpeg" ? inputBytes.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff])) :
      file.type === "image/png" ? inputBytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) :
      inputBytes.subarray(0,4).toString("ascii") === "RIFF" && inputBytes.subarray(8,12).toString("ascii") === "WEBP";
    if (!signatureMatches) throw new AuthFailure("VALIDATION_ERROR","파일 내용이 선택한 이미지 형식과 다르거나 지원하지 않는 형식이에요.");
    const image = sharp(inputBytes,{limitInputPixels:16000000,animated:false});
    const metadata = await image.metadata();const formats:Record<string,string> = {jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
    if (!metadata.format || formats[metadata.format] !== file.type || (metadata.pages ?? 1) > 1) throw new AuthFailure("VALIDATION_ERROR","정지 이미지의 실제 형식과 파일 형식이 같아야 해요.");
    const output = await image.rotate().resize(900,1350,{fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
    if (output.length > 2097152) throw new AuthFailure("VALIDATION_ERROR","변환한 이미지가 너무 커요. 작은 파일로 다시 선택해 주세요.");
    const begin = await account.client.rpc("admin_begin_cover",{p_work_id:workId,p_license:input,p_reason:reason});catalogueError(begin.error);
    staged = stagedSchema.parse(begin.data);
    const upload = await storage.storage.from("licensed-covers").upload(staged.path,output,{contentType:"image/webp",upsert:false,cacheControl:"0"});
    if (upload.error) throw new AuthFailure("INTERNAL_ERROR","이미지를 저장하지 못했어요.");
    const activate = await account.client.rpc("admin_activate_cover",{p_id:staged.id,p_reason:reason});catalogueError(activate.error);
    staged = undefined;refreshCatalogue();revalidatePath("/admin/works/"+workId+"/edit");
    return {ok:true,data:{message:"표지를 등록했어요. 표시·OG·PNG 허가는 각각 적용돼요."}};
  } catch(error) {
    if (staged && account) {
      try { await account.client.rpc("admin_revoke_cover",{p_id:staged.id,p_reason:"업로드 또는 활성화 실패 정리"}); } catch { /* Pending asset remains inaccessible. */ }
      if (storage) await storage.storage.from("licensed-covers").remove([staged.path]).catch(()=>undefined);
    }
    return actionError(error);
  }
}
export async function revokeCover(_state:FormState,form:FormData):Promise<FormState> {
  try {
    const {client} = await catalogueAdminAccount();
    const id = uuidSchema.parse(field(form,"assetId"));const reason = reasonSchema.parse(field(form,"reason").trim());
    const {error} = await client.rpc("admin_revoke_cover",{p_id:id,p_reason:reason});catalogueError(error);
    refreshCatalogue();revalidatePath("/admin/works","layout");
    return {ok:true,data:{message:"허가를 철회했어요. 새 이미지 요청은 차단돼요. 이미 배포된 파일은 회수할 수 없어요."}};
  } catch(error) { return actionError(error); }
}
