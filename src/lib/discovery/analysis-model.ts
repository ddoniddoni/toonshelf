import { z } from "zod";
import { readingSchema, tierSchema } from "@/lib/library/model";

const count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const categories=z.array(z.object({
 id:z.uuid().nullable(),name:z.string().min(1),weight:z.number().positive(),
 workCount:count.min(1),share:z.number().positive().max(1),
}));
export const tasteAnalysisSchema=z.object({
 viewerId:z.uuid(),computedAt:z.iso.datetime(),totalCount:count,readCount:count,
 statuses:z.partialRecord(readingSchema,count),
 ratings:z.partialRecord(z.enum(["1","2","3","4","5","6","7","8","9","10"]),count),
 tiers:z.partialRecord(tierSchema,count),genres:categories,platforms:categories,
}).superRefine((value,ctx)=>{
 const sum=(counts:Record<string,number>)=>Object.values(counts).reduce((a,b)=>a+b,0);
 const fail=()=>ctx.addIssue({code:"custom",message:"분석 집계가 일치하지 않아요."});
 if(sum(value.statuses)!==value.totalCount || value.readCount!==value.totalCount-(value.statuses.planned??0)
  || sum(value.ratings)>value.readCount || sum(value.tiers)>value.readCount)fail();
 for(const items of [value.genres,value.platforms]) {
  if(new Set(items.map(item=>item.id)).size!==items.length)fail();
  if(Math.abs(items.reduce((n,item)=>n+item.weight,0)-value.readCount)>0.000001*Math.max(1,value.readCount))fail();
  if(items.some(item=>item.workCount>value.readCount || item.weight>item.workCount+0.000001
   || Math.abs(item.share-item.weight/value.readCount)>0.000001))fail();
 }
});
export type TasteAnalysis=z.infer<typeof tasteAnalysisSchema>;
export function ratingSummary(ratings:TasteAnalysis["ratings"]) {
 const entries=Object.entries(ratings);
 const count=entries.reduce((sum,[,n])=>sum+n,0);
 return {count,average:count?entries.reduce((sum,[steps,n])=>sum+Number(steps)/2*n,0)/count:null};
}
