import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
const workIds=z.array(uuidSchema).max(5).refine(ids=>new Set(ids).size===ids.length,"작품 연결이 중복됐어요.");
export const postMergeHistoryInputSchema=z.strictObject({id:uuidSchema,page:z.number().int().min(1).max(1000)});
export const postMergeHistoryItemSchema=z.object({id:uuidSchema,sourceId:uuidSchema,targetId:uuidSchema,sourceTitle:z.string(),targetTitle:z.string(),
 publishedBefore:workIds,publishedAfter:workIds,draftBefore:workIds.nullable(),draftAfter:workIds.nullable(),createdAt:z.string()})
 .refine(v=>v.sourceId!==v.targetId && (v.draftBefore===null)===(v.draftAfter===null)
  && (v.publishedBefore.includes(v.sourceId) || Boolean(v.draftBefore?.includes(v.sourceId)))
  && !v.publishedAfter.includes(v.sourceId) && !v.draftAfter?.includes(v.sourceId),"작품 병합 이력을 확인해 주세요.");
export const postMergeHistorySchema=z.object({postId:uuidSchema,items:z.array(postMergeHistoryItemSchema).max(20),hasNext:z.boolean()});
export function postMergeHistoryUrl(id:string,page=1) {
 postMergeHistoryInputSchema.parse({id,page});return `/me/posts/${id}/merge-history${page>1 ? `?page=${page}` : ""}`;
}
