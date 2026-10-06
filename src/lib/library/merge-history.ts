import "server-only";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/catalogue/model";
import { recordSchema } from "./model";
import { libraryError } from "./errors";

const historySchema = z.object({items:z.array(z.object({
 id:uuidSchema,sourceId:uuidSchema,targetId:uuidSchema,currentTargetId:uuidSchema.nullable(),
 sourceTitle:z.string().nullable(),targetTitle:z.string().nullable(),
 sourceRecord:recordSchema.extend({evaluationCreatedAt:z.string().nullable(),evaluationUpdatedAt:z.string().nullable(),detailsUpdatedAt:z.string().nullable()}).nullable(),
 targetRecord:recordSchema.extend({evaluationCreatedAt:z.string().nullable(),evaluationUpdatedAt:z.string().nullable(),detailsUpdatedAt:z.string().nullable()}).nullable(),
 reviewId:uuidSchema.nullable(),createdAt:z.string()
})),total:z.number().int().nonnegative(),hasNext:z.boolean()});
export async function getMyMergeHistory(page:number) {
 const {client} = await requireAccount();
 const {data,error} = await client.rpc("toon_get_my_work_merge_history",{p_page:z.number().int().min(1).max(1000).parse(page)});
 libraryError(error);return historySchema.parse(data);
}
export async function getMyMergedWorkTarget(source:string) {
 const {client} = await requireAccount();
 const {data,error} = await client.rpc("toon_get_my_work_merge_target",{p_source:uuidSchema.parse(source)});
 libraryError(error);return data === null ? null : uuidSchema.parse(data);
}
