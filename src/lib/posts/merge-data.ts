import "server-only";
import { AuthFailure } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { postError } from "./errors";
import { postMergeHistoryInputSchema,postMergeHistorySchema } from "./merge-model";
export async function getMyPostMergeHistory(input:unknown) {
 const {client}=await requireAccount();const value=postMergeHistoryInputSchema.parse(input);
 const {data,error}=await client.rpc("toon_get_my_post_merge_history",{p_id:value.id,p_page:value.page});
 postError(error);if(data===null)return null;const result=postMergeHistorySchema.parse(data);
 if(result.postId!==value.id)throw new AuthFailure("INTERNAL_ERROR","현재 글의 작품 연결 이력을 확인하지 못했어요.");
 return result;
}
