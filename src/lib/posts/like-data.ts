import "server-only";
import { AuthFailure } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";
import { likeAccessSchema,likeStateSchema } from "./like-model";
import { postError as likeError } from "./errors";
export async function getPostLikeState(id:string) {
 const value=likeAccessSchema.parse({id});
 const {data,error}=await (await createClient()).rpc("toon_get_post_like_state",{p_id:value.id});
 likeError(error);if(data===null)return null;const state=likeStateSchema.parse(data);
 if(state.id!==id)throw new AuthFailure("INTERNAL_ERROR","좋아요 상태를 확인하지 못했어요.");return state;
}
