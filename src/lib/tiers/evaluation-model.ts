import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { readingSchema,tierSchema,visibilitySchema } from "@/lib/library/model";
import { versionSchema } from "./model";

export const evaluationModeSchema=z.enum(["import","apply"]);
export const evaluatedStatusSchema=z.enum(["reading","completed","dropped"]);
export const evaluationChoicesSchema=z.array(z.strictObject({workId:uuidSchema,status:evaluatedStatusSchema.nullable()})).min(1).max(100)
 .refine(items=>new Set(items.map(item=>item.workId.toLowerCase())).size === items.length,"같은 작품을 중복 선택했어요.");
export const evaluationInputSchema=z.strictObject({id:uuidSchema,mode:evaluationModeSchema,version:versionSchema.max(Number.MAX_SAFE_INTEGER-1),choices:evaluationChoicesSchema})
 .refine(input=>input.mode !== "import" || input.choices.every(item=>item.status === null),"가져오기에서는 읽기 상태를 변경하지 않아요.");
export const evaluationCommitSchema=evaluationInputSchema.safeExtend({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),confirm:z.literal(true)});
export const evaluationItemSchema=z.object({
 workId:uuidSchema,title:z.string().nullable(),workVersion:versionSchema.nullable(),status:readingSchema.nullable(),entryVersion:versionSchema.nullable(),
 ratingSteps:z.number().int().min(1).max(10).nullable(),sourceTier:tierSchema.nullable(),targetTier:tierSchema.nullable(),
 libraryVisibility:visibilitySchema.nullable(),evaluationVisibility:visibilitySchema.nullable(),
 fromRow:z.string().nullable(),toRow:z.string().nullable(),targetRowId:uuidSchema.nullable(),requiresStatus:z.boolean(),
 reason:z.enum(["unavailable","unplaced","custom","missing_row","unchanged"]).nullable()
});
export const evaluationContextSchema=z.object({id:uuidSchema,title:z.string(),version:versionSchema,mode:evaluationModeSchema,page:z.number().int().positive(),hasMore:z.boolean(),items:z.array(evaluationItemSchema).max(24)});
export const evaluationPreviewSchema=z.object({id:uuidSchema,mode:evaluationModeSchema,version:versionSchema,fingerprint:z.string().regex(/^[a-f0-9]{64}$/),
 items:z.array(evaluationItemSchema.extend({nextStatus:readingSchema.nullable()})).min(1).max(100)});
export const evaluationReplySchema=z.object({version:versionSchema,changed:z.number().int().min(1).max(100)});
export type EvaluationMode=z.infer<typeof evaluationModeSchema>;
export type EvaluationContext=z.infer<typeof evaluationContextSchema>;
export type EvaluationPreview=z.infer<typeof evaluationPreviewSchema>;
export type EvaluationChoice=z.infer<typeof evaluationChoicesSchema>[number];
export const skipLabels={unavailable:"현재 이용할 수 없는 작품",unplaced:"미배치 작품",custom:"기본 코드가 없는 사용자 행",missing_row:"이 기본 티어에 대응하는 행이 없어요",unchanged:"이미 같은 티어에 있어요"} as const;
export function evaluationUrl(id:string,mode:EvaluationMode,page=1) {return `/tiers/${id}/evaluations?mode=${mode}&page=${page}`;}
