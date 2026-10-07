"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { followAccessSchema,followInputSchema,followStateSchema } from "./model";
import { followError } from "./errors";
import { getPublicFollowState } from "./data";

export async function setUserFollow(input:unknown) {
 try {
  const {client}=await requireAccount();const value=followInputSchema.parse(input);
  const {data,error}=await client.rpc("toon_set_user_follow",{p_user:value.id,p_following:value.following});
  followError(error);
  // Null is a valid cancellation acknowledgement for a vanished/hidden target.
  if (data === null && value.following) throw new AuthFailure("INTERNAL_ERROR","팔로우 결과를 확인하지 못했어요. 현재 상태를 다시 확인해 주세요.");
  const parsed=data === null ? null : followStateSchema.safeParse(data);
  if (parsed && !parsed.success) throw new AuthFailure("INTERNAL_ERROR","팔로우 결과를 확인하지 못했어요. 현재 상태를 다시 확인해 주세요.");
  const state=parsed?.success ? parsed.data : null;
  if (state && (state.id !== value.id || state.following !== value.following)) throw new AuthFailure("INTERNAL_ERROR","팔로우 결과를 확인하지 못했어요. 현재 상태를 다시 확인해 주세요.");
  revalidatePath("/u/[username]","page");
  revalidatePath("/u/[username]/followers","page");
  revalidatePath("/u/[username]/following","page");
  revalidatePath("/me/feed");
  return {ok:true as const,state};
 } catch(error) {return actionError(error);}
}
export async function reloadUserFollow(input:unknown) {
 try {
  const value=followAccessSchema.parse(input),state=await getPublicFollowState(value.username);
  if (!state) throw new AuthFailure("NOT_FOUND","현재 열람할 수 없는 프로필이에요.");
  return {ok:true as const,state};
 } catch(error) {return actionError(error);}
}
