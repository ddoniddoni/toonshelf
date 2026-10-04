import "server-only";
import { getPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/catalogue/model";
import { requireModerator } from "@/lib/reviews/moderation";
import { publicationError as tierError } from "./errors";
import { hashShareToken } from "./share-token";
import { previewSchema,publicationSchema,publicTierListSchema,tierReportQueueSchema,tierModerationSchema } from "./publication-model";
import { tierDiscoveryFiltersSchema,type TierDiscoveryFilters } from "./discovery-model";
import { z } from "zod";

export async function getPublicationPreview(id:string) {
 const {client}=await requireAccount();const {data,error}=await client.rpc("preview_tier_publication",{p_id:uuidSchema.parse(id)});
 tierError(error);return data === null ? null : previewSchema.parse(data);
}
export async function getTierPublication(id:string|null,token:string|null=null) {
 if (!getPublicEnv().supabase) return null;
 const p_id=id === null ? null : uuidSchema.parse(id),p_hash=token === null ? null : hashShareToken(token);
 const {data,error}=await (await createClient()).rpc("get_tier_publication",{p_id,p_hash,p_reveal:false,p_version:null});
 tierError(error);return data === null ? null : publicationSchema.parse(data);
}
export async function listPublicTiers(page:number,filters:TierDiscoveryFilters={sort:"latest",tag:null}) {
 const value=tierDiscoveryFiltersSchema.parse(filters);z.number().int().min(1).max(1000).parse(page);
 if (!getPublicEnv().supabase) return null;
 const {data,error}=await (await createClient()).rpc("search_public_tiers",{p_sort:value.sort,p_tag:value.tag,p_page:page});tierError(error);return publicTierListSchema.parse(data);
}
export async function listTierReports(page:number,own=false) {
 const {client}=own ? await requireAccount() : await requireModerator();
 const {data,error}=await client.rpc(own ? "list_my_tier_reports" : "list_tier_reports",{p_page:page});tierError(error);return tierReportQueueSchema.parse(data);
}
export async function getTierModeration(id:string) {
 const {client}=await requireModerator();const {data,error}=await client.rpc("moderation_tier_snapshot",{p_id:uuidSchema.parse(id)});
 tierError(error);return data === null ? null : tierModerationSchema.parse(data);
}
