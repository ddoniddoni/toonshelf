"use server";
import { revalidatePath } from "next/cache";
import { actionError } from "@/lib/auth/errors";
import { requireAccount } from "@/lib/auth/session";
import { featuredInputSchema,featuredStateSchema } from "./featured-model";
import { featuredError } from "./errors";

export async function setFeaturedTier(input:unknown) {
 try {
  const {client}=await requireAccount();const value=featuredInputSchema.parse(input);
  const {data,error}=await client.rpc("set_featured_tier",{p_id:value.id,p_tier_version:value.tierVersion,p_featured_version:value.featuredVersion});
  featuredError(error);const state=featuredStateSchema.parse(data);
  revalidatePath("/u/[username]","page");revalidatePath("/me/tiers");revalidatePath("/tiers/[id]/publish","page");
  return {ok:true as const,state};
 } catch(error) {return actionError(error);}
}
