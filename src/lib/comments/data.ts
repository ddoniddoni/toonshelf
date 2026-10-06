import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { requireAccount } from "@/lib/auth/session";
import { requireModerator } from "@/lib/reviews/moderation";
import { uuidSchema } from "@/lib/catalogue/model";
import { versionSchema } from "@/lib/tiers/model";
import { commentError } from "./errors";
import { commentListInputSchema,commentPageSchema,maskedCommentSchema,commentReportsSchema,maskedCommentModerationSchema } from "./model";
export async function listTierComments(input:unknown) {
 const v=commentListInputSchema.parse(input);if (!getPublicEnv().supabase) return null;
 const {data,error}=await (await createClient()).rpc("list_tier_comments",{p_tier:v.tierId,p_tier_version:v.tierVersion,p_parent:v.parentId,p_page:v.page});
 commentError(error);return data === null ? null : commentPageSchema.parse(data);
}
export async function getTierComment(id:string,tierVersion:number) {
 uuidSchema.parse(id);versionSchema.parse(tierVersion);if (!getPublicEnv().supabase) return null;
 const {data,error}=await (await createClient()).rpc("get_tier_comment",{p_id:id,p_tier_version:tierVersion,p_version:null,p_reveal:false});
 commentError(error);return data === null ? null : maskedCommentSchema.parse(data);
}
export async function listCommentReports(page:number,own=false) {
 z.number().int().min(1).max(1000).parse(page);const {client}=own ? await requireAccount() : await requireModerator();
 const {data,error}=await client.rpc("list_tier_comment_reports",{p_page:page,p_own:own});commentError(error);return commentReportsSchema.parse(data);
}
export async function getCommentModeration(id:string) {
 const {client}=await requireModerator();const {data,error}=await client.rpc("moderation_tier_comment_snapshot",{p_id:uuidSchema.parse(id),p_version:null,p_reveal:false});
 commentError(error);return data === null ? null : maskedCommentModerationSchema.parse(data);
}
