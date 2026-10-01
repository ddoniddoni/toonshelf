"use server";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccount } from "./session";
import { actionError, AuthFailure, databaseError } from "./errors";
import { getMyProfile } from "./data";
import type { FormState } from "@/types/auth";

export async function uploadAvatar(_previous:FormState,form:FormData):Promise<FormState> {
  try {
    const account = await requireAccount(); const admin = createAdminClient();
    const {error:rateError} = await account.client.rpc("reserve_account_request",{p_action:"avatar"}); databaseError(rateError);
    const file = form.get("avatar");
    if (!(file instanceof File) || file.size < 1 || file.size > 2097152 || !["image/jpeg","image/png","image/webp"].includes(file.type)) throw new AuthFailure("VALIDATION_ERROR","JPEG·PNG·WebP 사진을 2MB 이하로 선택해 주세요.");
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = sharp(buffer,{limitInputPixels:16000000,animated:false});
    const metadata = await image.metadata();
    const formats:Record<string,string> = {jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
    if (!metadata.format || formats[metadata.format] !== file.type || (metadata.pages ?? 1) > 1) throw new AuthFailure("VALIDATION_ERROR","이 이미지 형식은 사용할 수 없어요.");
    const output = await image.rotate().resize(512,512,{fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
    const profile = await getMyProfile(); const path = `${account.user.id}/${randomUUID()}.webp`;
    const {error:uploadError} = await admin.storage.from("avatars").upload(path,output,{contentType:"image/webp",upsert:false,cacheControl:"60"});
    if (uploadError) throw new AuthFailure("INTERNAL_ERROR","사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    const {error} = await admin.rpc("set_user_avatar",{p_user_id:account.user.id,p_session_id:account.sessionId,p_path:path});
    if (error) { await admin.storage.from("avatars").remove([path]); databaseError(error); }
    if (profile?.avatar_path?.startsWith(`${account.user.id}/`)) await admin.storage.from("avatars").remove([profile.avatar_path]);
    revalidatePath("/settings/profile");
    return {ok:true,data:{message:"프로필 사진을 저장했어요."}};
  } catch(error) { return actionError(error); }
}
export async function removeAvatar():Promise<FormState> {
  try {
    const account = await requireAccount(); const admin = createAdminClient(); const profile = await getMyProfile();
    const {error:rateError} = await account.client.rpc("reserve_account_request",{p_action:"avatar"}); databaseError(rateError);
    if (profile?.avatar_path?.startsWith(`${account.user.id}/`)) { const {error:removeError} = await admin.storage.from("avatars").remove([profile.avatar_path]); if (removeError) throw new AuthFailure("INTERNAL_ERROR","사진을 제거하지 못했어요. 잠시 후 다시 시도해 주세요."); }
    const {error} = await admin.rpc("set_user_avatar",{p_user_id:account.user.id,p_session_id:account.sessionId,p_path:null}); databaseError(error);
    revalidatePath("/settings/profile"); return {ok:true,data:{message:"프로필 사진을 제거했어요."}};
  } catch(error) { return actionError(error); }
}
