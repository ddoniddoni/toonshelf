import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/catalogue/model";
import { editorSchema,listSchema,mergeHistorySchema } from "./model";
import { tierError } from "./errors";
export async function getTierEditor(id:string) {
 const {client}=await requireAccount();const {data,error}=await client.rpc("get_my_tier_editor",{p_id:uuidSchema.parse(id)});
 tierError(error);return data === null ? null : editorSchema.parse(data);
}
export async function listTierDrafts(page:number) {
 const {client}=await requireAccount();const {data,error}=await client.rpc("list_my_tier_drafts",{p_page:page});
 tierError(error);return listSchema.parse(data);
}
export async function getTierMergeHistory(id:string,page:number) {
 const {client}=await requireAccount();const {data,error}=await client.rpc("get_my_tier_merge_history",{p_id:uuidSchema.parse(id),p_page:page});tierError(error);
 return data === null ? null : mergeHistorySchema.parse(data);
}
