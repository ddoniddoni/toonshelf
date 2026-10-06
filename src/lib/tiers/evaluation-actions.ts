"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { actionError } from "@/lib/auth/errors";
import { evaluationCommitSchema,evaluationInputSchema,evaluationPreviewSchema,evaluationReplySchema } from "./evaluation-model";
import { evaluationError } from "./errors";

export async function previewTierEvaluations(input:unknown) {
 try {
  const {client}=await requireAccount();const value=evaluationInputSchema.parse(input);
  const {data,error}=await client.rpc("toon_preview_tier_evaluations",{p_id:value.id,p_mode:value.mode,p_version:value.version,p_choices:value.choices});
  evaluationError(error);return {ok:true as const,preview:evaluationPreviewSchema.parse(data)};
 } catch(error) {return actionError(error);}
}
export async function commitTierEvaluations(input:unknown) {
 try {
  const {client}=await requireAccount();const value=evaluationCommitSchema.parse(input);
  const {data,error}=await client.rpc("toon_commit_tier_evaluations",{p_id:value.id,p_mode:value.mode,p_version:value.version,p_choices:value.choices,p_fingerprint:value.fingerprint,p_confirm:true});
  evaluationError(error);const result=evaluationReplySchema.parse(data);
  revalidatePath(`/tiers/${value.id}/evaluations`);
  if (value.mode === "import") {
   revalidatePath(`/tiers/${value.id}/edit`);revalidatePath(`/tiers/${value.id}/publish`);revalidatePath("/me/tiers");
  } else {
   revalidatePath("/me/library","layout");revalidatePath("/me","layout");revalidatePath("/works/[slug]","page");
   revalidatePath("/u/[username]","page");revalidatePath("/u/[username]/library","page");revalidatePath("/settings/privacy");
  }
  return {ok:true as const,...result};
 } catch(error) {return actionError(error);}
}
