import { z } from "zod";
import { cardSchema,uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "@/lib/library/model";
const text = (min:number,max:number) => z.string().refine(v=>Array.from(v).length >= min && Array.from(v).length <= max,`${min}~${max}자로 입력해 주세요.`);
export const draftPayloadSchema = z.strictObject({body:text(0,5000),isSpoiler:z.boolean(),episode:z.number().int().min(0).max(1000000).nullable()});
export const publishPayloadSchema = draftPayloadSchema.refine(v=>Array.from(v.body.trim()).length >= 20,"게시할 리뷰는 20자 이상 작성해 주세요.");
export const reviewCardSchema = z.object({id:uuidSchema,workId:uuidSchema,workTitle:z.string(),workSlug:z.string(),authorId:uuidSchema,
 username:z.string(),name:z.string(),avatar:z.string().nullable(),isSpoiler:z.boolean(),episode:z.number().int().nullable(),excerpt:z.string().nullable(),
 version:versionSchema,publishedAt:z.string(),updatedAt:z.string(),ratingSteps:z.number().int().min(1).max(10).nullable(),canonicalTier:z.enum(["S","A","B","C","D","F"]).nullable()});
export type ReviewCard = z.infer<typeof reviewCardSchema>;
export const reviewDetailSchema = reviewCardSchema.extend({body:z.string().nullable()});
export const reviewListSchema = z.object({items:z.array(reviewCardSchema),total:z.number().int().nonnegative(),hasNext:z.boolean()});
export const editorSchema = z.object({id:uuidSchema,workId:uuidSchema,work:cardSchema.nullable(),reviewVersion:versionSchema,
 publicationStatus:z.enum(["draft","published"]),moderationStatus:z.enum(["visible","hidden"]),publishedAt:z.string().nullable(),updatedAt:z.string(),
 publishedBody:z.string(),publishedSpoiler:z.boolean(),publishedEpisode:z.number().nullable(),draftVersion:versionSchema,draft:draftPayloadSchema,draftUpdatedAt:z.string()});
export type ReviewEditor = z.infer<typeof editorSchema>;
export const myReviewListSchema = z.object({items:z.array(editorSchema),total:z.number().int().nonnegative(),hasNext:z.boolean()});
export const reportReasonSchema = z.enum(["spoiler","piracy","personal_information","harassment","spam","other"]);
export const reportInputSchema = z.strictObject({reviewId:uuidSchema,reason:reportReasonSchema,detail:text(10,2000)});
export const reportLabels = {spoiler:"스포일러 표시 누락",piracy:"불법 복제 서비스 링크",personal_information:"개인정보 노출",harassment:"괴롭힘·혐오 표현",spam:"도배·광고",other:"기타"} as const;
export const blockListSchema = z.array(z.object({id:uuidSchema,username:z.string().nullable(),name:z.string()}));
export const reportRowSchema = z.object({id:uuidSchema,review_id:uuidSchema,reason:reportReasonSchema,detail:z.string(),status:z.enum(["pending","resolved","rejected"]),result_note:z.string(),created_at:z.string(),resolved_at:z.string().nullable()});
export const moderationReportSchema = reportRowSchema.pick({id:true,reason:true,detail:true,status:true,result_note:true,created_at:true});
export const moderationSchema = z.object({id:uuidSchema,version:versionSchema,publicationStatus:z.enum(["draft","published"]),moderationStatus:z.enum(["visible","hidden"]),
 deleted:z.boolean(),isSpoiler:z.boolean(),body:z.string().nullable(),reports:z.array(moderationReportSchema),events:z.array(z.object({action:z.string(),reason:z.string(),created_at:z.string()}))});
export type ModerationSnapshot = z.infer<typeof moderationSchema>;
export const reportQueueSchema = z.object({items:z.array(reportRowSchema.pick({id:true,review_id:true,reason:true,detail:true,status:true,created_at:true})),hasNext:z.boolean()});
export const moderationInputSchema = z.strictObject({reviewId:uuidSchema,version:versionSchema,action:z.enum(["hide","restore","reject_report"]),reason:text(2,1000),reportId:uuidSchema.nullable(),result:text(0,500)})
 .refine(v=>v.action !== "reject_report" || v.reportId !== null,"기각할 신고를 선택해 주세요.")
 .refine(v=>v.reportId === null || Array.from(v.result.trim()).length >= 2,"신고자에게 안내할 결과를 입력해 주세요.");
export type BodyResult = {ok:true;body:string}|{ok:false;message:string};
export function safeReviewLink(value:string):string|null {
 try {const url = new URL(value);return ["http:","https:"].includes(url.protocol) && !url.username && !url.password && !/[\u0000-\u0020\u007f]/.test(value) ? url.href : null;}catch{return null;}
}
