import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { AuthFailure,databaseError } from "@/lib/auth/errors";
import { sharedSInputSchema,sharedSRecommendationsSchema } from "./shared-s-model";

export async function getSharedSRecommendations(input:unknown) {
 const value=sharedSInputSchema.parse(input);
 if(!getPublicEnv().supabase)throw new AuthFailure("CONFIG_REQUIRED","작품 추천 기능을 준비하고 있어요.");
 // Request cookies retain the viewer's block boundary; no privileged client or shared cache.
 const {data,error}=await (await createClient()).rpc("toon_get_shared_s_recommendations",{p_work:value.workId});
 if(error) {
  if(["PGRST202","PGRST205","42883","42P01"].includes(error.code ?? ""))throw new AuthFailure("CONFIG_REQUIRED","작품 추천 기능을 준비하고 있어요.");
  if(error.code==="57014")throw new AuthFailure("CONFLICT","추천 계산에 시간이 걸리고 있어요. 잠시 후 다시 방문해 주세요.");
  databaseError(error);
 }
 if(data===null)return null;
 const parsed=sharedSRecommendationsSchema.safeParse(data);
 if(!parsed.success || parsed.data.workId!==value.workId)throw new AuthFailure("INTERNAL_ERROR","추천 정보를 확인하지 못했어요.");
 return parsed.data;
}
