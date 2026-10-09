import { z } from "zod";
import { usernameSchema } from "@/lib/auth/validation";
import { slugSchema,uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { tierSchema } from "@/lib/library/model";

export const comparisonSections = ["all","common_s","different"] as const;
export const comparisonSectionSchema = z.enum(comparisonSections);
export const comparisonLabels = {all:"공통 평가",common_s:"함께 S인 작품",different:"평가가 갈리는 작품"} as const;
const pageSchema = z.number().int().min(1).max(1000);
export const comparisonInputSchema = z.strictObject({username:usernameSchema,section:comparisonSectionSchema,page:pageSchema});
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const base = z.object({work:z.object({id:uuidSchema,slug:slugSchema,title:z.string().refine(s=>[...s].length>=1 && [...s].length<=200)}),difference:z.number().min(0).max(1)});
export const comparisonItemSchema = z.discriminatedUnion("signal",[
 base.extend({signal:z.literal("tier"),mine:tierSchema,other:tierSchema}),
 base.extend({signal:z.literal("rating"),mine:z.number().int().min(1).max(10),other:z.number().int().min(1).max(10)})
]);
export const comparisonSchema = z.object({
 profile:z.object({id:uuidSchema,username:usernameSchema,name:z.string().refine(s=>[...s].length>=2 && [...s].length<=30)}),
 commonCount:count,tierCount:count,ratingCount:count,commonSCount:count,differentCount:count,
 similarity:z.number().int().min(0).max(100).nullable(),confidence:z.number().min(0).max(1),
 section:comparisonSectionSchema,page:pageSchema,hasNext:z.boolean(),items:z.array(comparisonItemSchema).max(20)
}).superRefine((v,ctx)=>{
 const selected = v.section === "common_s" ? v.commonSCount : v.section === "different" ? v.differentCount : v.commonCount;
 if(v.tierCount+v.ratingCount!==v.commonCount || v.commonSCount>v.tierCount || v.commonSCount+v.differentCount>v.commonCount
  || (v.commonCount<5)!==(v.similarity===null) || Math.abs(v.confidence-v.commonCount/(v.commonCount+10))>1e-10
  || v.hasNext!==(selected>v.page*20) || v.items.length!==Math.min(20,Math.max(0,selected-(v.page-1)*20))
  || new Set(v.items.map(item=>item.work.id)).size!==v.items.length
  || v.items.some(item=>(v.section==="common_s" && !(item.signal==="tier" && item.mine==="S" && item.other==="S")) || (v.section==="different" && item.difference<0.4)))
  ctx.addIssue({code:"custom",message:"비교 결과가 일치하지 않아요."});
});
export type TasteComparison = z.infer<typeof comparisonSchema>;
export type ComparisonSection = z.infer<typeof comparisonSectionSchema>;
export function comparisonUrl(username:string,section:ComparisonSection="all",page=1) {
 const v=comparisonInputSchema.parse({username,section,page});
 const query=new URLSearchParams();if(v.section!=="all")query.set("section",v.section);if(v.page>1)query.set("page",String(v.page));
 return `/compare/${v.username}`+(query.size ? `?${query}` : "");
}
export function parseComparisonSearch(search:SearchParams) {
 const value=z.strictObject({section:comparisonSectionSchema.optional(),page:z.string().regex(/^[1-9][0-9]{0,3}$/).optional()}).parse(search);
 return {section:value.section ?? "all",page:pageSchema.parse(value.page ? Number(value.page) : 1)};
}
export function comparisonSampleLabel(n:number) {
 return n<5 ? "표본 부족" : n<10 ? "적은 표본" : n<30 ? "보통 표본" : "많은 표본";
}
