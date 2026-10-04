import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { usernameSchema } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { featuredError } from "./errors";
import { featuredStateSchema } from "./featured-model";
import { publicTierCardSchema } from "./publication-model";

export async function getMyFeaturedTierState() {
 const {client}=await requireAccount();const {data,error}=await client.rpc("get_my_featured_tier_state");
 featuredError(error);return featuredStateSchema.parse(data);
}
export async function getPublicFeaturedTier(username:string) {
 const value=usernameSchema.parse(username);if (!getPublicEnv().supabase) return null;
 const {data,error}=await (await createClient()).rpc("get_public_featured_tier",{p_username:value});
 featuredError(error);return data === null ? null : publicTierCardSchema.parse(data);
}
