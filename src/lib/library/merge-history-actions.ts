"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/session";
import { actionError,AuthFailure } from "@/lib/auth/errors";
import { checked,field } from "@/lib/auth/validation";
import { uuidSchema } from "@/lib/catalogue/model";
import { libraryError } from "./errors";
import type { FormState } from "@/types/auth";

export async function deleteMergeHistory(_state:FormState,form:FormData):Promise<FormState> {
 try {
  const {client} = await requireAccount();
  const id = uuidSchema.parse(field(form,"id"));
  if (!checked(form,"confirm")) throw new AuthFailure("VALIDATION_ERROR","보관한 원본 기록 삭제를 확인해 주세요.");
  const {error} = await client.rpc("delete_my_work_merge_history",{p_id:id,p_confirm:true});
  libraryError(error);
 } catch (error) {return actionError(error);}
 revalidatePath("/me/library/merges");redirect("/me/library/merges?deleted=1");
}
