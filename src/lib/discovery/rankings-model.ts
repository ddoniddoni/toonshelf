import { z } from "zod";
import { cardSchema,type SearchParams } from "@/lib/catalogue/model";

export const audienceLabels={all:"전체 공개 평가",completed:"완독자",experienced:"공개 독서 기록 30편 이상 회원",completed_experienced:"완독 + 공개 독서 기록 30편 이상 회원"} as const;
export const rankingFiltersSchema=z.strictObject({
 audience:z.enum(["all","completed","experienced","completed_experienced"]),
 platform:z.string().regex(/^[a-z0-9_]{1,40}$/).nullable(),genre:z.string().regex(/^[a-z0-9-]{1,80}$/).nullable(),
 section:z.enum(["ranked","insufficient"]),page:z.number().int().min(1).max(1000),
});
export type RankingFilters=z.infer<typeof rankingFiltersSchema>;
export function parseRankingFilters(params:SearchParams):RankingFilters {
 const query=z.strictObject({audience:z.string().optional(),platform:z.string().optional(),genre:z.string().optional(),section:z.string().optional(),page:z.string().regex(/^[1-9][0-9]{0,3}$/).optional()}).parse(params);
 return rankingFiltersSchema.parse({audience:query.audience??"all",platform:query.platform||null,genre:query.genre||null,section:query.section??"ranked",page:query.page?Number(query.page):1});
}
export function rankingsUrl(filters:RankingFilters,changes:Partial<RankingFilters>={}) {
 const {audience,platform,genre,section,page}=filters;
 const value=rankingFiltersSchema.parse({audience,platform,genre,section,page,...changes});const query=new URLSearchParams();
 for(const [key,item] of Object.entries(value))if(item!==null)query.set(key,String(item));
 return `/rankings?${query}`;
}
const count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const rankingsSchema=rankingFiltersSchema.extend({computedAt:z.iso.datetime(),total:count,hasNext:z.boolean(),
 items:z.array(z.object({work:cardSchema,sampleCount:count,rank:count.min(1).nullable(),average:z.number().min(.5).max(5).nullable()})).max(20),
}).superRefine((value,ctx)=>{
 const offset=(value.page-1)*20;
 const invalid=value.items.length!==Math.min(20,Math.max(0,value.total-offset))
  || value.hasNext!==(value.page<1000 && value.total>offset+20)
  || new Set(value.items.map(item=>item.work.id)).size!==value.items.length
  || value.items.some((item,index)=>value.section==="ranked"
   ?item.sampleCount<5 || item.average===null || item.rank!==offset+index+1
   :item.sampleCount>=5 || item.average!==null || item.rank!==null);
 if(invalid)ctx.addIssue({code:"custom",message:"순위 집계가 일치하지 않아요."});
});
export type Rankings=z.infer<typeof rankingsSchema>;
