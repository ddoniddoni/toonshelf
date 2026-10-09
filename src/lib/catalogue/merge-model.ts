import { z } from "zod";
import { uuidSchema } from "./model";

const count = z.number().int().nonnegative();
const work = z.object({id:uuidSchema,title:z.string(),version:z.number().int().positive(),status:z.string()});
export const communityMergeSchema=z.object({posts:count,drafts:count,deduplicatedPosts:count,deduplicatedDrafts:count})
 .refine(v=>v.deduplicatedPosts<=v.posts && v.deduplicatedDrafts<=v.drafts,"작품 연결 병합 건수를 확인해 주세요.");
// Administrator DTO: counts and catalogue metadata only, never owner content.
export const mergePreviewSchema = z.object({
  source:work,target:work,previewToken:uuidSchema,
  blockedByPersonalDomains:z.boolean(),sourceLinkCount:count,sourceGenreCount:count,sourceCoverWillBeRevoked:z.boolean(),
  records:z.object({library:count,overlappingLibrary:count,evaluations:count,reviews:count,drafts:count,tiers:count}),
  conflicts:z.object({notes:count,tags:count,plannedEvaluations:count,dates:count,reviews:count,unavailable:count,metadata:count}),
  canMerge:z.boolean(),community:communityMergeSchema.optional()
});
export const mergePolicySchema = z.literal("latest_private");
