import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { AuthFailure, databaseError } from "@/lib/auth/errors";
import { personalRecommendationsSchema } from "./personal-model";

export async function getPersonalRecommendations() {
 const {client,user}=await requireAccount();
 const {data,error}=await client.rpc("toon_get_personal_recommendations");
 if(error) {
  if(["PGRST202","PGRST205","42883","42P01"].includes(error.code ?? ""))
   throw new AuthFailure("CONFIG_REQUIRED","개인 추천 기능을 준비하고 있어요. 잠시 후 다시 방문해 주세요.");
  if(error.code==="57014")throw new AuthFailure("CONFLICT","추천 계산에 시간이 걸리고 있어요. 잠시 후 다시 불러와 주세요.");
  databaseError(error);
 }
 const parsed=personalRecommendationsSchema.safeParse(data);
 if(!parsed.success || parsed.data.viewerId!==user.id)throw new AuthFailure("INTERNAL_ERROR","개인 추천 결과를 확인하지 못했어요.");
 return parsed.data;
}
