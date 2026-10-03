import { z } from "zod";
import { uuidSchema } from "./model";

const count = z.number().int().nonnegative();
const work = z.object({id:uuidSchema,title:z.string(),version:z.number().int().positive(),status:z.string()});
// Administrator DTO: counts and catalogue metadata only, never owner content.
export const mergePreviewSchema = z.object({
  source:work,target:work,previewToken:uuidSchema,
  blockedByPersonalDomains:z.boolean(),sourceLinkCount:count,sourceGenreCount:count,sourceCoverWillBeRevoked:z.boolean(),
  records:z.object({library:count,overlappingLibrary:count,evaluations:count,reviews:count,drafts:count}),
  conflicts:z.object({notes:count,tags:count,plannedEvaluations:count,dates:count,reviews:count,unavailable:count,metadata:count}),
  canMerge:z.boolean()
});
export const mergePolicySchema = z.literal("latest_private");
