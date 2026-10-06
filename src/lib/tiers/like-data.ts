import "server-only";
import { createClient } from "@/lib/supabase/server";
import { likeAccessSchema,likeStateSchema } from "./like-model";
import { likeError } from "./errors";
export async function getTierLikeState(id:string) {
 const value=likeAccessSchema.parse({id});
 const {data,error}=await (await createClient()).rpc("toon_get_tier_like_state",{p_id:value.id});
 likeError(error);return data === null ? null : likeStateSchema.parse(data);
}
