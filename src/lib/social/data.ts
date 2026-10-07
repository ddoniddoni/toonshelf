import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { AuthFailure } from "@/lib/auth/errors";
import { followAccessSchema,followListInputSchema,followListSchema,followStateSchema,type FollowKind } from "./model";
import { followError } from "./errors";

// React cache is scoped to this render/request; never share viewer-specific counts.
export const getPublicFollowState = cache(async (username:string) => {
 const value=followAccessSchema.parse({username});
 if (!getPublicEnv().supabase) return null;
 const {data,error}=await (await createClient()).rpc("toon_get_public_follow_state",{p_username:value.username});
 followError(error);if (data === null) return null;
 const parsed=followStateSchema.safeParse(data);
 if (!parsed.success || parsed.data.username !== value.username) throw new AuthFailure("INTERNAL_ERROR","팔로우 정보를 확인하지 못했어요. 다시 불러와 주세요.");
 return parsed.data;
});
export async function listPublicFollows(username:string,kind:FollowKind,page:number) {
 const value=followListInputSchema.parse({username,kind,page});
 if (!getPublicEnv().supabase) return null;
 const {data,error}=await (await createClient()).rpc("toon_list_public_follows",{p_username:value.username,p_kind:value.kind,p_page:value.page});
 followError(error);if (data === null) return null;
 const parsed=followListSchema.safeParse(data);
 if (!parsed.success || parsed.data.profile.username !== value.username || parsed.data.kind !== value.kind || parsed.data.page !== value.page)
  throw new AuthFailure("INTERNAL_ERROR","팔로우 목록을 확인하지 못했어요. 다시 불러와 주세요.");
 return parsed.data;
}
