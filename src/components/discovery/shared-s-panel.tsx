import "server-only";
import { AuthFailure } from "@/lib/auth/errors";
import { getSharedSRecommendations } from "@/lib/discovery/shared-s-data";
import { SharedSRecommendationList } from "./shared-s-recommendations";

export async function SharedSPanel({workId}:{workId:string}) {
 let result;
 try {result=await getSharedSRecommendations({workId});}
 catch(error) {
  const message=error instanceof AuthFailure && error.code==="CONFIG_REQUIRED" ? "작품 추천 기능을 준비하고 있어요."
   : error instanceof AuthFailure && ["AUTH_REQUIRED","FORBIDDEN","ONBOARDING_REQUIRED","EMAIL_UNVERIFIED"].includes(error.code) ? "현재 계정 상태로는 추천을 표시할 수 없어요."
   : "지금 추천을 불러오지 못했어요. 잠시 후 다시 방문해 주세요.";
  // A recommendation failure must not block the work or masquerade as a small sample.
  return <p className="field-hint" role="status">{message}</p>;
 }
 if(result===null)return <p className="field-hint" role="status">현재 이 작품의 추천을 표시할 수 없어요.</p>;
 return <SharedSRecommendationList result={result}/>;
}
