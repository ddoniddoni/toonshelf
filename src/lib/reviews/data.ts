import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { requireAccount } from "@/lib/auth/session";
import { usernameSchema } from "@/lib/auth/validation";
import { reviewApiUnavailable } from "./availability";
import { uuidSchema } from "@/lib/catalogue/model";
import { reviewError } from "./errors";
import { blockListSchema,editorSchema,myReviewListSchema,reviewDetailSchema,reviewListSchema,reviewDiscoverySchema,reviewSortSchema,reportRowSchema,type ReviewSort } from "./model";
import { z } from "zod";
export const getReview = cache(async(id:string)=>{
 if (!getPublicEnv().supabase || !uuidSchema.safeParse(id).success) return null;
 const {data,error} = await (await createClient()).rpc("toon_get_review",{p_id:id,p_reveal:false,p_expected_version:null});
 reviewError(error);return data === null ? null : reviewDetailSchema.parse(data);
});
export async function listReviews(workId:string|null,username:string|null,page=1,sort:ReviewSort="latest") {
 const input=z.object({work:uuidSchema.nullable(),username:usernameSchema.nullable(),page:z.number().int().min(1).max(1000),sort:reviewSortSchema})
  .refine(v=>(v.work===null)!==(v.username===null)).parse({work:workId,username,page,sort});
 const client=await createClient();
 const {data,error}=await client.rpc("toon_search_reviews",{p_work:input.work,p_username:input.username,p_page:input.page,p_sort:input.sort});
 if(reviewApiUnavailable(error)) {
  const legacy=await client.rpc("toon_list_reviews",{p_work:input.work,p_username:input.username,p_page:input.page});
  reviewError(legacy.error);return legacy.data===null ? null : {...reviewListSchema.parse(legacy.data),sort:"latest" as const,engagementAvailable:false};
 }
 reviewError(error);return data===null ? null : {...reviewDiscoverySchema.parse(data),sort:input.sort,engagementAvailable:true};
}
export async function getMyReviewEditor(id:string) {
 const {client} = await requireAccount();
 const {data,error} = await client.rpc("toon_get_my_review_editor",{p_id:uuidSchema.parse(id)});
 reviewError(error);return data === null ? null : editorSchema.parse(data);
}
export async function listMyReviews(page:number) {
 const {client} = await requireAccount();const {data,error} = await client.rpc("toon_list_my_reviews",{p_page:page});
 reviewError(error);return myReviewListSchema.parse(data);
}
export async function getMyBlocks() {
 const {client} = await requireAccount();const {data,error} = await client.rpc("toon_get_my_blocks");
 reviewError(error);return blockListSchema.parse(data);
}
export async function getMyReports(page:number) {
 const {client,user} = await requireAccount();
 const {data,error} = await client.from("toon_reports").select("id,review_id,reason,detail,status,result_note,created_at,resolved_at").eq("reporter_id",user.id).order("created_at",{ascending:false}).order("id").range((page-1)*20,page*20);
 reviewError(error);const rows = z.array(reportRowSchema).parse(data);return {items:rows.slice(0,20),hasNext:rows.length > 20};
}
