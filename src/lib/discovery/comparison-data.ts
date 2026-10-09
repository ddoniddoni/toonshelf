import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { AuthFailure,databaseError } from "@/lib/auth/errors";
import { comparisonInputSchema,comparisonSchema } from "./comparison-model";

export async function getTasteComparison(input:unknown) {
 const {client,user}=await requireAccount();
 const value=comparisonInputSchema.parse(input);
 const {data,error}=await client.rpc("toon_compare_taste",{p_username:value.username,p_section:value.section,p_page:value.page});
 if(error) {
  if(["PGRST202","PGRST205","42883","42P01"].includes(error.code ?? ""))
   throw new AuthFailure("CONFIG_REQUIRED","취향 비교 기능을 준비하고 있어요. 잠시 후 다시 방문해 주세요.");
  if(error.message==="SELF_COMPARE")throw new AuthFailure("VALIDATION_ERROR","다른 회원의 프로필에서 취향을 비교해 주세요.");
  if(error.code==="57014")throw new AuthFailure("CONFLICT","비교에 시간이 걸리고 있어요. 잠시 후 다시 불러와 주세요.");
  databaseError(error);
 }
 if(data===null)return null;
 const parsed=comparisonSchema.safeParse(data);
 if(!parsed.success || parsed.data.profile.username!==value.username || parsed.data.profile.id===user.id
  || parsed.data.section!==value.section || parsed.data.page!==value.page)
  throw new AuthFailure("INTERNAL_ERROR","취향 비교 결과를 확인하지 못했어요. 다시 불러와 주세요.");
 return parsed.data;
}
