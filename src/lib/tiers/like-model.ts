import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "./model";
export const likeCountSchema=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const likeAccessSchema=z.strictObject({id:uuidSchema});
export const likeInputSchema=likeAccessSchema.extend({version:versionSchema,liked:z.boolean()});
export const likeStateSchema=z.object({id:uuidSchema,version:versionSchema,likeCount:likeCountSchema,liked:z.boolean(),canLike:z.boolean()});
export type TierLikeState=z.infer<typeof likeStateSchema>;
