import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "@/lib/library/model";
export const likeCountSchema=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const likeAccessSchema=z.strictObject({id:uuidSchema});
export const likeInputSchema=likeAccessSchema.extend({version:versionSchema,liked:z.boolean()});
export const likeStateSchema=z.object({id:uuidSchema,version:versionSchema,likeCount:likeCountSchema,liked:z.boolean(),canLike:z.boolean()}).refine(v=>!v.liked || (v.canLike && v.likeCount>0),"좋아요 상태와 집계가 일치하지 않아요.");
export type ReviewLikeState=z.infer<typeof likeStateSchema>;
