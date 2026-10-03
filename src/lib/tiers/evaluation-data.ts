import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/catalogue/model";
import { evaluationContextSchema,evaluationModeSchema,type EvaluationMode } from "./evaluation-model";
import { evaluationError } from "./errors";

export async function getTierEvaluations(id:string,mode:EvaluationMode,page:number) {
 const {client}=await requireAccount();
 const {data,error}=await client.rpc("get_my_tier_evaluations",{p_id:uuidSchema.parse(id),p_mode:evaluationModeSchema.parse(mode),p_page:page});
 evaluationError(error);return data === null ? null : evaluationContextSchema.parse(data);
}
