import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { requireAccount } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/catalogue/model";
import { reviewError } from "./errors";
import { blockListSchema,editorSchema,myReviewListSchema,reviewDetailSchema,reviewListSchema,reportRowSchema } from "./model";
import { z } from "zod";
export const getReview = cache(async(id:string)=>{
 if (!getPublicEnv().supabase || !uuidSchema.safeParse(id).success) return null;
 const {data,error} = await (await createClient()).rpc("get_review",{p_id:id,p_reveal:false,p_expected_version:null});
 reviewError(error);return data === null ? null : reviewDetailSchema.parse(data);
});
export async function listReviews(workId:string|null,username:string|null,page=1) {
 const {data,error} = await (await createClient()).rpc("list_reviews",{p_work:workId,p_username:username,p_page:page});
 reviewError(error);return data === null ? null : reviewListSchema.parse(data);
}
export async function getMyReviewEditor(id:string) {
 const {client} = await requireAccount();
 const {data,error} = await client.rpc("get_my_review_editor",{p_id:uuidSchema.parse(id)});
 reviewError(error);return data === null ? null : editorSchema.parse(data);
}
export async function listMyReviews(page:number) {
 const {client} = await requireAccount();const {data,error} = await client.rpc("list_my_reviews",{p_page:page});
 reviewError(error);return myReviewListSchema.parse(data);
}
export async function getMyBlocks() {
 const {client} = await requireAccount();const {data,error} = await client.rpc("get_my_blocks");
 reviewError(error);return blockListSchema.parse(data);
}
export async function getMyReports(page:number) {
 const {client,user} = await requireAccount();
 const {data,error} = await client.from("reports").select("id,review_id,reason,detail,status,result_note,created_at,resolved_at").eq("reporter_id",user.id).order("created_at",{ascending:false}).order("id").range((page-1)*20,page*20);
 reviewError(error);const rows = z.array(reportRowSchema).parse(data);return {items:rows.slice(0,20),hasNext:rows.length > 20};
}
