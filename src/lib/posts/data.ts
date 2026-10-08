import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/auth/session";
import { requireModerator } from "@/lib/reviews/moderation";
import { getPublicEnv } from "@/lib/env/public";
import { uuidSchema } from "@/lib/catalogue/model";
import { postError } from "./errors";
import { editorSchema,filtersSchema,moderationSchema,myPostListSchema,postCardSchema,postDetailSchema,postListSchema,reportListSchema,reportQueueSchema,type PostFilters } from "./model";
export const getPost=cache(async(id:string)=>{
 if(!uuidSchema.safeParse(id).success || !getPublicEnv().supabase)return null;
 const {data,error}=await (await createClient()).rpc("toon_get_post",{p_id:id,p_reveal:false,p_expected_version:null});postError(error);
 if(data===null)return null;postCardSchema.parse(data);const post=postDetailSchema.parse(data);
 if(post.isSpoiler && post.body!==null)throw new Error("Invalid public post projection");return post;
});
export async function listPosts(input:PostFilters) {
 const v=filtersSchema.parse(input);const {data,error}=await (await createClient()).rpc("toon_list_posts",{p_category:v.category,p_work:v.work,p_q:v.q,p_page:v.page});postError(error);return postListSchema.parse(data);
}
export async function getMyPostEditor(id:string) {
 const {client}=await requireAccount();const {data,error}=await client.rpc("toon_get_my_post_editor",{p_id:uuidSchema.parse(id)});postError(error);return data===null ? null : editorSchema.parse(data);
}
export async function listMyPosts(page:number) {
 const {client}=await requireAccount();const {data,error}=await client.rpc("toon_list_my_posts",{p_page:page});postError(error);return myPostListSchema.parse(data);
}
export async function getMyPostReports(page:number) {
 const {client}=await requireAccount();const {data,error}=await client.rpc("toon_list_my_post_reports",{p_page:page});postError(error);return reportListSchema.parse(data);
}
export async function getPostModeration(id:string) {
 const {client}=await requireModerator();const {data,error}=await client.rpc("toon_moderation_post_snapshot",{p_id:uuidSchema.parse(id),p_reveal:false,p_expected_version:null});postError(error);return data===null ? null : moderationSchema.parse(data);
}
export async function listPostReports(page:number) {
 const {client}=await requireModerator();const {data,error}=await client.rpc("toon_list_post_reports",{p_page:page});postError(error);return reportQueueSchema.parse(data);
}
