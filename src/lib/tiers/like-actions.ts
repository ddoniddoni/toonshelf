"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { likeAccessSchema,likeInputSchema,likeStateSchema } from "./like-model";
import { getTierLikeState } from "./like-data";
import { likeError } from "./errors";
export async function setTierLike(input:unknown) {
 try {
  const {client}=await requireAccount();const value=likeInputSchema.parse(input);
  const {data,error}=await client.rpc("set_tier_like",{p_id:value.id,p_version:value.version,p_liked:value.liked});
  likeError(error);
  if (data === null) throw new AuthFailure("NOT_FOUND","현재 좋아요를 표시할 수 있는 공개 티어표가 없어요.");
  const state=likeStateSchema.parse(data);revalidatePath("/tiers");revalidatePath(`/tiers/${value.id}`);
  return {ok:true as const,state};
 } catch(error) {return actionError(error);}
}
export async function reloadTierLike(input:unknown) {
 try {
  const value=likeAccessSchema.parse(input),state=await getTierLikeState(value.id);
  if (!state) throw new AuthFailure("NOT_FOUND","더 이상 공개된 티어표를 볼 수 없어요.");
  return {ok:true as const,state};
 } catch(error) {return actionError(error);}
}
