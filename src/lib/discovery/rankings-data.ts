import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { AuthFailure,databaseError } from "@/lib/auth/errors";
import { rankingFiltersSchema,rankingsSchema,type RankingFilters } from "./rankings-model";

export async function getWorkRankings(filters:RankingFilters) {
 const value=rankingFiltersSchema.parse(filters);
 if(!getPublicEnv().supabase)throw new AuthFailure("CONFIG_REQUIRED","작품 순위 기능을 준비하고 있어요.");
 const {data,error}=await (await createClient()).rpc("toon_get_work_rankings",{p_audience:value.audience,p_platform:value.platform,p_genre:value.genre,p_section:value.section,p_page:value.page});
 if(error) {
  if(["PGRST202","PGRST205","42883","42P01"].includes(error.code??""))throw new AuthFailure("CONFIG_REQUIRED","작품 순위 기능을 준비하고 있어요.");
  if(error.code==="57014")throw new AuthFailure("CONFLICT","순위 집계에 시간이 걸리고 있어요. 잠시 후 다시 불러와 주세요.");
  if(error.message==="VALIDATION_ERROR")throw new AuthFailure("VALIDATION_ERROR","순위 조건을 다시 선택해 주세요. 제공되지 않는 장르나 플랫폼일 수 있어요.");
  databaseError(error);
 }
 const parsed=rankingsSchema.safeParse(data);
 if(!parsed.success)throw new AuthFailure("INTERNAL_ERROR","작품 순위를 확인하지 못했어요.");
 const result=parsed.data;
 if(Object.entries(value).some(([key,item])=>result[key as keyof RankingFilters]!==item))throw new AuthFailure("INTERNAL_ERROR","작품 순위 조건을 확인하지 못했어요.");
 return result;
}
