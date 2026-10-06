import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { AuthFailure } from "@/lib/auth/errors";
import { uuidSchema } from "@/lib/catalogue/model";
import { publicationError } from "./errors";
import { hashShareToken } from "./share-token";
import { imageRequestSchema,imageSourceSchema } from "./image-model";

export async function readTierImageSource(id:string,input:unknown,reserve=false) {
  const request=imageRequestSchema.parse(input), p_id=uuidSchema.parse(id);
  const {client}=await requireAccount();
  const {data,error}=await client.rpc(reserve ? "toon_begin_tier_image_export" : "toon_get_tier_image_source",{
    p_id,p_source:request.source,p_version:request.version,
    p_hash:request.token === null ? null : hashShareToken(request.token),p_confirm_spoiler:request.confirmSpoiler,
  });
  publicationError(error);
  if (data === null) throw new AuthFailure("NOT_FOUND","현재 접근할 수 있는 티어표를 찾을 수 없어요.");
  return imageSourceSchema.parse(data);
}
