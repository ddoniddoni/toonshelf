import { describe,expect,it } from "vitest";
import { sharedSInputSchema,sharedSRecommendationsSchema } from "@/lib/discovery/shared-s-model";
const source="59000000-0000-4000-8000-000000000001";
const card={id:"59000000-0000-4000-8000-000000000002",slug:"candidate-work",title:"추천 작품",aliases:[],serialStatus:"ongoing",ageRating:"all",createdAt:"2026-10-10T00:00:00Z",coverAssetId:null,coverAttribution:"",creators:[],genres:[],platforms:[]};
const item={work:card,sampleCount:5,sharedSCount:3,coSRatio:0.6,rankingScore:0.2};
const result={workId:source,computedAt:"2026-10-10T00:00:00.000001Z",items:[item]};
describe("shared S recommendation contract (written only)",()=>{
 it("accepts the exact minimum sample and preserves empty results without scores",()=>{
  expect(sharedSRecommendationsSchema.parse(result).items[0]?.sampleCount).toBe(5);
  expect(sharedSRecommendationsSchema.parse({...result,items:[]}).items).toEqual([]);
 });
 it("rejects undersized or inconsistent evidence",()=>{
  for(const patch of [{sampleCount:4},{sharedSCount:2},{sharedSCount:6},{coSRatio:0.9},{rankingScore:0.6}])
   expect(sharedSRecommendationsSchema.safeParse({...result,items:[{...item,...patch}]}).success).toBe(false);
 });
 it("excludes source, duplicates and unapproved evaluator metadata",()=>{
  expect(sharedSRecommendationsSchema.safeParse({...result,items:[item,item]}).success).toBe(false);
  expect(sharedSRecommendationsSchema.safeParse({...result,items:[{...item,work:{...card,id:source}}]}).success).toBe(false);
  expect(sharedSRecommendationsSchema.safeParse({...result,items:Array.from({length:7},(_,i)=>({...item,work:{...card,id:`59000000-0000-4000-8000-${String(i+2).padStart(12,"0")}`}}))}).success).toBe(false);
  const parsed=sharedSRecommendationsSchema.parse({...result,cohortIds:["secret"],items:[{...item,userIds:["secret"],privateNote:"secret"}]});
  expect(JSON.stringify(parsed)).not.toContain("secret");
  expect(sharedSInputSchema.safeParse({workId:source,viewerId:"secret"}).success).toBe(false);
 });
});
