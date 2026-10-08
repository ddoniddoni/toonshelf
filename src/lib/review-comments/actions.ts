"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { requireModerator } from "@/lib/reviews/moderation";
import { createClient } from "@/lib/supabase/server";
import { checked,field } from "@/lib/auth/validation";
import { uuidSchema } from "@/lib/catalogue/model";
import type { FormState } from "@/types/auth";
import { commentError } from "./errors";
import { commentCreateSchema,commentEditSchema,commentDeleteSchema,commentAccessSchema,commentRevealSchema,commentReportInputSchema,
 commentModerateInputSchema,commentSchema,commentEditorSchema,commentModerationSchema } from "./model";
function invalidate() {revalidatePath("/");revalidatePath("/works/[slug]","page");revalidatePath("/works/[slug]/reviews","page");revalidatePath("/u/[username]","page");revalidatePath("/u/[username]/reviews","page");revalidatePath("/me/notifications");revalidatePath("/reviews","layout");revalidatePath("/admin/review-comment-reports");revalidatePath("/admin/review-comments/[id]","page");revalidatePath("/me/review-comment-reports");}
export async function createReviewComment(input:unknown) {
 try {
  const {client}=await requireAccount();const v=commentCreateSchema.parse(input);
  const {data,error}=await client.rpc("toon_create_review_comment",{p_id:v.id,p_review:v.reviewId,p_review_version:v.reviewVersion,p_parent:v.parentId,p_body:v.body,p_spoiler:v.isSpoiler,p_confirm:true});
  commentError(error);const id=uuidSchema.parse(data);if(id!==v.id)throw new AuthFailure("INTERNAL_ERROR","댓글 등록 결과를 확인하지 못했어요. 최신 댓글을 불러와 주세요.");invalidate();return {ok:true as const,id};
 } catch(error) {return actionError(error);}
}
export async function getMyReviewComment(input:unknown) {
 try {
  const {client}=await requireAccount();const v=commentAccessSchema.parse(input);
  const {data,error}=await client.rpc("toon_get_my_review_comment",{p_id:v.id,p_review_version:v.reviewVersion,p_version:v.version});commentError(error);
  if (data === null) throw new AuthFailure("NOT_FOUND","수정할 내 댓글을 찾을 수 없어요.");const editor=commentEditorSchema.parse(data);
  if(editor.id!==v.id || editor.version!==v.version)throw new AuthFailure("CONFLICT","수정할 댓글의 최신 상태를 다시 확인해 주세요.");return {ok:true as const,editor};
 } catch(error) {return actionError(error);}
}
export async function updateReviewComment(input:unknown) {
 try {
  const {client}=await requireAccount();const v=commentEditSchema.parse(input);
  const {error}=await client.rpc("toon_update_review_comment",{p_id:v.id,p_review_version:v.reviewVersion,p_version:v.version,p_body:v.body,p_spoiler:v.isSpoiler,p_confirm:true});
  commentError(error);invalidate();return {ok:true as const};
 } catch(error) {return actionError(error);}
}
export async function deleteReviewComment(input:unknown) {
 try {
  const {client}=await requireAccount();const v=commentDeleteSchema.parse(input);
  const {error}=await client.rpc("toon_delete_review_comment",{p_id:v.id,p_version:v.version,p_confirm:true});commentError(error);invalidate();return {ok:true as const};
 } catch(error) {return actionError(error);}
}
export async function revealReviewComment(input:unknown) {
 try {
  const v=commentRevealSchema.parse(input);const {data,error}=await (await createClient()).rpc("toon_get_review_comment",{p_id:v.id,p_review_version:v.reviewVersion,p_version:v.version,p_reveal:true});
  commentError(error);if (data === null) throw new AuthFailure("NOT_FOUND","현재 댓글을 펼칠 수 없어요.");
  const comment=commentSchema.parse(data);if (comment.id!==v.id || comment.version!==v.version || comment.body === null) throw new AuthFailure("NOT_FOUND","더 이상 본문을 볼 수 없어요.");return {ok:true as const,body:comment.body};
 } catch(error) {return actionError(error);}
}
export async function reportReviewComment(input:unknown) {
 try {
  const {client}=await requireAccount();const v=commentReportInputSchema.parse(input);
  const {error}=await client.rpc("toon_report_review_comment",{p_id:v.id,p_review_version:v.reviewVersion,p_version:v.version,p_reason:v.reason,p_detail:v.detail});
  commentError(error);revalidatePath("/me/review-comment-reports");revalidatePath("/admin/review-comment-reports");return {ok:true as const};
 } catch(error) {return actionError(error);}
}
export async function revealModerationComment(input:unknown) {
 try {
  const {client}=await requireModerator();const v=commentDeleteSchema.parse(input);
  const {data,error}=await client.rpc("toon_moderation_review_comment_snapshot",{p_id:v.id,p_version:v.version,p_reveal:true});commentError(error);
  const snapshot=commentModerationSchema.parse(data);if (snapshot.id!==v.id || snapshot.version!==v.version || snapshot.body === null) throw new AuthFailure("NOT_FOUND","현재 검토할 공개 댓글 본문이 없어요.");
  return {ok:true as const,body:snapshot.body};
 } catch(error) {return actionError(error);}
}
export async function moderateReviewComment(_state:FormState,form:FormData):Promise<FormState> {
 let id:string;
 try {
  const {client}=await requireModerator();const v=commentModerateInputSchema.parse({id:field(form,"id"),version:Number(field(form,"version")),
   action:field(form,"operation"),reason:field(form,"reason"),reportId:field(form,"reportId") || null,result:field(form,"result")});id=v.id;
  if (!checked(form,"confirm")) throw new AuthFailure("VALIDATION_ERROR","조치 내용을 확인해 주세요.");
  const {error}=await client.rpc("toon_moderate_review_comment",{p_id:v.id,p_version:v.version,p_action:v.action,p_reason:v.reason,p_report:v.reportId,p_result:v.result});commentError(error);
 } catch(error) {return actionError(error);}
 invalidate();redirect(`/admin/review-comments/${id}`);
}
