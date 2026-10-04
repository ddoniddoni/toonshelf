import { z } from "zod";
import { cardSchema,uuidSchema } from "@/lib/catalogue/model";
import { rowSchema,versionSchema } from "./model";
import { reportReasonSchema } from "@/lib/reviews/model";
import { likeCountSchema } from "./like-model";
import { tierThemeTagSchema } from "./discovery-model";

// A 32-byte base64url token: the last character has two zero padding bits.
export const shareTokenSchema=z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
export const hashSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const envelopeSchema=z.strictObject({hash:hashSchema,ciphertext:z.string().regex(/^[a-f0-9]{118}$/),nonce:z.string().regex(/^[a-f0-9]{24}$/)});
export type ShareEnvelope=z.infer<typeof envelopeSchema>;
export const publicationBodySchema=z.strictObject({title:z.string(),description:z.string(),tags:z.array(z.string()),
 rows:z.array(rowSchema.extend({items:z.array(cardSchema.nullable()).max(300)})).min(2).max(10)});
export type PublicationBody=z.infer<typeof publicationBodySchema>;
export const publicationStateSchema=z.object({id:uuidSchema,version:versionSchema,visibility:z.enum(["private","public","unlisted"]),
 publishedVersion:versionSchema.nullable(),moderationStatus:z.enum(["visible","hidden"]),publishedAt:z.string().nullable(),hasShareToken:z.boolean()});
export type PublicationState=z.infer<typeof publicationStateSchema>;
export const previewSchema=z.object({draftVersion:versionSchema,state:publicationStateSchema,body:publicationBodySchema,fingerprint:hashSchema});
export type PublicationPreview=z.infer<typeof previewSchema>;
export const publishInputSchema=z.strictObject({id:uuidSchema,draftVersion:versionSchema,listVersion:versionSchema,fingerprint:hashSchema,
 visibility:z.enum(["public","unlisted"]),isSpoiler:z.boolean(),confirm:z.literal(true)});
export const lifecycleInputSchema=z.strictObject({id:uuidSchema,version:versionSchema,confirm:z.literal(true)});
export const accessInputSchema=z.strictObject({id:uuidSchema,token:shareTokenSchema.nullable()});
export const revealInputSchema=accessInputSchema.extend({version:versionSchema,confirm:z.literal(true)});
export const publicationSchema=z.object({id:uuidSchema,version:versionSchema,publishedVersion:versionSchema,publishedAt:z.string(),
 authorId:uuidSchema,username:z.string(),name:z.string(),isSpoiler:z.boolean(),likeCount:likeCountSchema.nullable(),body:publicationBodySchema.nullable()});
export type TierPublication=z.infer<typeof publicationSchema>;
export const publicTierCardSchema=publicationSchema.omit({body:true}).extend({title:z.string().nullable(),
 tags:z.array(tierThemeTagSchema).max(5).nullable(),likeCount:likeCountSchema,recentLikeCount:likeCountSchema})
 .superRefine((v,ctx)=>{
  if (v.recentLikeCount > v.likeCount) ctx.addIssue({code:"custom",message:"최근 반응 수를 확인해 주세요."});
  if (v.isSpoiler ? v.title !== null || v.tags !== null : v.title === null || v.tags === null)
   ctx.addIssue({code:"custom",message:"현재 공개 범위를 확인해 주세요."});
 });
export const publicTierListSchema=z.object({items:z.array(publicTierCardSchema).max(12),hasNext:z.boolean()});
export const tierReportSchema=z.object({id:uuidSchema,tierId:uuidSchema,reason:reportReasonSchema,detail:z.string(),
 status:z.enum(["pending","resolved","rejected"]),result:z.string(),createdAt:z.string()});
export const tierReportQueueSchema=z.object({items:z.array(tierReportSchema),hasNext:z.boolean()});
export const tierModerationSchema=z.object({id:uuidSchema,version:versionSchema,visibility:z.enum(["private","public","unlisted"]),
 moderationStatus:z.enum(["visible","hidden"]),deleted:z.boolean(),body:publicationBodySchema.nullable(),
 reports:z.array(tierReportSchema),events:z.array(z.object({action:z.string(),reason:z.string(),createdAt:z.string()}))});
export type TierModeration=z.infer<typeof tierModerationSchema>;
