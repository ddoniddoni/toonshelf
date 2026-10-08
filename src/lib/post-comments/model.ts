import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "@/lib/library/model";
import { reportReasonSchema } from "@/lib/reviews/model";
const text=(min:number,max:number)=>z.string().trim().refine(v=>Array.from(v).length >= min && Array.from(v).length <= max,`${min}~${max}자로 입력해 주세요.`);
export const commentBodySchema=text(1,1000);
export const commentSchema=z.object({id:uuidSchema,postId:uuidSchema,parentId:uuidSchema.nullable(),version:versionSchema,
 createdAt:z.string(),updatedAt:z.string(),deleted:z.boolean(),isSpoiler:z.boolean(),body:commentBodySchema.nullable(),
 author:z.object({id:uuidSchema,username:z.string(),name:z.string()}).nullable(),canEdit:z.boolean(),canReport:z.boolean(),canReply:z.boolean(),replyCount:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)})
 .superRefine((v,ctx)=>{
  if (v.deleted ? v.body !== null || v.author !== null || v.canEdit || v.canReport || v.canReply : v.author === null || (!v.isSpoiler && v.body === null))
   ctx.addIssue({code:"custom",message:"댓글의 현재 공개 범위를 확인해 주세요."});
  if (v.parentId !== null && (v.replyCount !== 0 || v.canReply)) ctx.addIssue({code:"custom",message:"답글은 한 단계까지만 허용해요."});
  if (v.canEdit && v.canReport) ctx.addIssue({code:"custom",message:"댓글 작성자 권한을 확인해 주세요."});
 });
export type PostComment=z.infer<typeof commentSchema>;
export const maskedCommentSchema=commentSchema.refine(v=>!v.isSpoiler || v.body === null,"스포일러 원문은 펼치기 전 전달하지 않아요.");
export const commentPageSchema=z.object({postId:uuidSchema,postVersion:versionSchema,parentId:uuidSchema.nullable(),items:z.array(maskedCommentSchema).max(20),hasNext:z.boolean()})
 .refine(v=>v.items.every(c=>c.postId === v.postId && c.parentId === v.parentId),"다른 글이나 스레드의 댓글은 포함하지 않아요.");
export type CommentPage=z.infer<typeof commentPageSchema>;
export const commentListInputSchema=z.strictObject({postId:uuidSchema,postVersion:versionSchema,parentId:uuidSchema.nullable(),page:z.number().int().min(1).max(1000)});
export const commentAccessSchema=z.strictObject({id:uuidSchema,postVersion:versionSchema,version:versionSchema});
export const commentCreateSchema=z.strictObject({id:uuidSchema,postId:uuidSchema,postVersion:versionSchema,parentId:uuidSchema.nullable(),body:commentBodySchema,isSpoiler:z.boolean(),confirm:z.literal(true)});
export const commentEditSchema=commentAccessSchema.extend({body:commentBodySchema,isSpoiler:z.boolean(),confirm:z.literal(true)});
export const commentDeleteSchema=z.strictObject({id:uuidSchema,version:versionSchema,confirm:z.literal(true)});
export const commentRevealSchema=commentAccessSchema.extend({confirm:z.literal(true)});
export const commentEditorSchema=z.object({id:uuidSchema,version:versionSchema,body:commentBodySchema,isSpoiler:z.boolean()});
export type CommentEditor=z.infer<typeof commentEditorSchema>;
export const commentReportInputSchema=commentAccessSchema.extend({reason:reportReasonSchema,detail:text(10,2000)});
export const commentReportSchema=z.object({id:uuidSchema,commentId:uuidSchema,reason:reportReasonSchema,detail:z.string(),status:z.enum(["pending","resolved","rejected"]),result:z.string(),createdAt:z.string()});
export const commentReportsSchema=z.object({items:z.array(commentReportSchema).max(20),hasNext:z.boolean()});
export const commentModerationSchema=z.object({id:uuidSchema,version:versionSchema,postId:uuidSchema,deleted:z.boolean(),moderationStatus:z.enum(["visible","hidden"]),
 canModerate:z.boolean(),body:commentBodySchema.nullable(),reports:z.array(commentReportSchema).max(50),events:z.array(z.object({action:z.string(),reason:z.string(),createdAt:z.string()})).max(50)})
 .refine(v=>v.body === null || v.canModerate,"현재 검토할 공개 댓글만 원문을 제공해요.");
export const maskedCommentModerationSchema=commentModerationSchema.refine(v=>v.body === null,"운영 검토도 펼치기 전 원문을 제공하지 않아요.");
export type CommentModeration=z.infer<typeof commentModerationSchema>;
export const commentModerateInputSchema=z.strictObject({id:uuidSchema,version:versionSchema,action:z.enum(["hide","restore","reject_report"]),reason:text(2,1000),reportId:uuidSchema.nullable(),result:text(0,500)})
 .refine(v=>v.action !== "reject_report" || v.reportId !== null,"기각할 신고를 선택해 주세요.")
 .refine(v=>v.reportId === null || Array.from(v.result).length >= 2,"신고자에게 안내할 결과를 입력해 주세요.");
export const commentQuerySchema=z.strictObject({parent:uuidSchema.optional(),page:z.string().regex(/^[1-9][0-9]{0,3}$/).optional()})
 .transform(v=>({parentId:v.parent ?? null,page:v.page === undefined ? 1 : Number(v.page)}))
 .refine(v=>v.page <= 1000,"페이지 번호를 확인해 주세요.");
export function commentPageUrl(postId:string,parentId:string|null=null,page=1) {
 uuidSchema.parse(postId);if (parentId !== null) uuidSchema.parse(parentId);z.number().int().min(1).max(1000).parse(page);
 const query=new URLSearchParams();if (parentId !== null) query.set("parent",parentId);if (page > 1) query.set("page",String(page));
 return `/posts/${postId}/comments${query.size ? `?${query}` : ""}#comments`;
}
