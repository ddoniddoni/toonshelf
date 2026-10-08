import "server-only";
import { AuthFailure } from "@/lib/auth/errors";

export function reviewApiUnavailable(error:{code?:string}|null) {
 return error !== null && ["PGRST202","PGRST205","42883","42P01"].includes(error.code ?? "");
}
// Only a missing database API is an expected rollout state. Other failures
// must still reach the error boundary instead of looking like an empty list.
export async function withReviewAvailability<T>(read:()=>Promise<T>):Promise<{available:true;value:T}|{available:false}> {
 try {return {available:true,value:await read()};}
 catch(error) {if(error instanceof AuthFailure && error.code==="CONFIG_REQUIRED")return {available:false};throw error;}
}
