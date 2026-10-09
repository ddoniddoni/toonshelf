import { z } from "zod";
import { cardSchema,uuidSchema } from "@/lib/catalogue/model";

export const sharedSInputSchema=z.strictObject({workId:uuidSchema});
const count=z.number().int().max(Number.MAX_SAFE_INTEGER);
export const sharedSItemSchema=z.object({work:cardSchema,sampleCount:count.min(5),sharedSCount:count.min(3),
 coSRatio:z.number().min(0).max(1),rankingScore:z.number().min(0).max(1)})
 .refine(v=>v.sharedSCount<=v.sampleCount && Math.abs(v.coSRatio-v.sharedSCount/v.sampleCount)<1e-10
  && Math.abs(v.rankingScore-v.sharedSCount/(v.sampleCount+10))<1e-10,"추천 근거와 계산 결과가 일치하지 않아요.");
export const sharedSRecommendationsSchema=z.object({workId:uuidSchema,computedAt:z.iso.datetime({offset:true}),items:z.array(sharedSItemSchema).max(6)})
 .refine(v=>v.items.every(item=>item.work.id!==v.workId) && new Set(v.items.map(item=>item.work.id)).size===v.items.length,
  "추천 작품이 중복됐거나 기준 작품이 포함됐어요.");
export type SharedSRecommendations=z.infer<typeof sharedSRecommendationsSchema>;
