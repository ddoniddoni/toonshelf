import { z } from "zod";
import { cardSchema, uuidSchema } from "@/lib/catalogue/model";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const common = {viewerId:uuidSchema,computedAt:z.iso.datetime({offset:true}),ownEvaluationCount:count};
const fallback = {reason:z.enum(["insufficient_evaluations","no_candidates"])};
export const personalItemSchema = z.object({work:cardSchema,sampleCount:count.min(3).max(50),
 score:z.number().min(0.6).max(1),minCommonCount:count.min(5),maxCommonCount:count.min(5)})
 .refine(v=>v.minCommonCount<=v.maxCommonCount,"공통 평가 범위가 올바르지 않아요.");
export const personalRecommendationsSchema = z.discriminatedUnion("mode",[
 z.object({...common,mode:z.literal("collaborative"),items:z.array(personalItemSchema).min(1).max(12)}),
 z.object({...common,...fallback,mode:z.literal("genre"),items:z.array(z.object({work:cardSchema,genres:z.array(z.string().min(1).max(100)).min(1).max(12)})).min(1).max(12)}),
 z.object({...common,...fallback,mode:z.literal("empty"),items:z.array(z.never()).length(0)}),
]).superRefine((v,ctx)=>{
 if(new Set(v.items.map(i=>i.work.id)).size!==v.items.length)ctx.addIssue({code:"custom",message:"추천 작품이 중복됐어요."});
 if(v.mode==="collaborative") {
  if(v.ownEvaluationCount<5 || v.items.some(i=>i.maxCommonCount>v.ownEvaluationCount))ctx.addIssue({code:"custom",message:"추천 표본이 올바르지 않아요."});
 } else if((v.reason==="insufficient_evaluations")!==(v.ownEvaluationCount<5))ctx.addIssue({code:"custom",message:"표본 안내가 올바르지 않아요."});
});
export type PersonalRecommendations = z.infer<typeof personalRecommendationsSchema>;
