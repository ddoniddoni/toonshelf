import "server-only";
import { AuthFailure } from "@/lib/auth/errors";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { requireAccount } from "@/lib/auth/session";
import { requireModerator } from "@/lib/reviews/moderation";
import { uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "@/lib/library/model";
import { commentError } from "./errors";
import { commentListInputSchema,commentPageSchema,maskedCommentSchema,commentReportsSchema,maskedCommentModerationSchema } from "./model";
export async function listPostComments(input:unknown) {
 const v=commentListInputSchema.parse(input);if (!getPublicEnv().supabase) return null;
 const {data,error}=await (await createClient()).rpc("toon_list_post_comments",{p_post:v.postId,p_post_version:v.postVersion,p_parent:v.parentId,p_page:v.page});
 commentError(error);if(data===null)return null;const result=commentPageSchema.parse(data);
 if(result.postId!==v.postId || result.postVersion!==v.postVersion || result.parentId!==v.parentId)throw new AuthFailure("CONFLICT","최신 글의 댓글을 다시 불러와 주세요.");return result;
}
export async function getPostComment(id:string,postVersion:number) {
 uuidSchema.parse(id);versionSchema.parse(postVersion);if (!getPublicEnv().supabase) return null;
 const {data,error}=await (await createClient()).rpc("toon_get_post_comment",{p_id:id,p_post_version:postVersion,p_version:null,p_reveal:false});
 commentError(error);if(data===null)return null;const comment=maskedCommentSchema.parse(data);
 if(comment.id!==id)throw new AuthFailure("NOT_FOUND","현재 댓글을 확인하지 못했어요.");return comment;
}
export async function listCommentReports(page:number,own=false) {
 z.number().int().min(1).max(1000).parse(page);const {client}=own ? await requireAccount() : await requireModerator();
 const {data,error}=await client.rpc("toon_list_post_comment_reports",{p_page:page,p_own:own});commentError(error);return commentReportsSchema.parse(data);
}
export async function getCommentModeration(id:string) {
 const {client}=await requireModerator();const {data,error}=await client.rpc("toon_moderation_post_comment_snapshot",{p_id:uuidSchema.parse(id),p_version:null,p_reveal:false});
 commentError(error);return data === null ? null : maskedCommentModerationSchema.parse(data);
}
