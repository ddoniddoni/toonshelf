"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { likeAccessSchema,likeInputSchema,likeStateSchema } from "./like-model";
import { getReviewLikeState } from "./like-data";
import { reviewError as likeError } from "./errors";
export async function setReviewLike(input:unknown) {
 try {
  const {client}=await requireAccount();const value=likeInputSchema.parse(input);
  const {data,error}=await client.rpc("toon_set_review_like",{p_id:value.id,p_version:value.version,p_liked:value.liked});
  likeError(error);
  if (data === null) throw new AuthFailure("NOT_FOUND","현재 좋아요를 표시할 수 있는 공개 리뷰가 없어요.");
  const state=likeStateSchema.parse(data);
  if(state.id!==value.id || state.version!==value.version || state.liked!==value.liked)throw new AuthFailure("INTERNAL_ERROR","좋아요 결과를 확인하지 못했어요. 현재 상태를 다시 불러와 주세요.");
  revalidatePath("/");revalidatePath("/works/[slug]","page");revalidatePath("/works/[slug]/reviews","page");revalidatePath("/u/[username]","page");revalidatePath("/u/[username]/reviews","page");revalidatePath(`/reviews/${value.id}`);revalidatePath("/me/notifications");
  return {ok:true as const,state};
 } catch(error) {return actionError(error);}
}
export async function reloadReviewLike(input:unknown) {
 try {
  const value=likeAccessSchema.parse(input),state=await getReviewLikeState(value.id);
  if (!state) throw new AuthFailure("NOT_FOUND","더 이상 공개된 리뷰를 볼 수 없어요.");
  return {ok:true as const,state};
 } catch(error) {return actionError(error);}
}
