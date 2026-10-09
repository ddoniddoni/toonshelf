import { describe,expect,it } from "vitest";
import { comparisonInputSchema,comparisonSchema,comparisonSampleLabel,comparisonUrl,parseComparisonSearch } from "@/lib/discovery/comparison-model";
const profile={id:"38000000-0000-4000-8000-000000000002",username:"reader_two",name:"비교 회원"};
const work={id:"58000000-0000-4000-8000-000000000001",slug:"comparison-work",title:"공통 작품"};
const item={work,signal:"tier",mine:"S",other:"S",difference:0};
const small={profile,commonCount:1,tierCount:1,ratingCount:0,commonSCount:1,differentCount:0,similarity:null,confidence:1/11,section:"all",page:1,hasNext:false,items:[item]};
describe("private taste comparison contract (written, not executed)",()=>{
 it("does not turn insufficient data into a zero score",()=>{
  expect(comparisonSchema.parse(small).similarity).toBeNull();
  expect(comparisonSchema.safeParse({...small,similarity:0}).success).toBe(false);
  const enough={...small,commonCount:5,tierCount:5,commonSCount:0,confidence:5/15,page:2,items:[],similarity:0};
  expect(comparisonSchema.parse(enough).similarity).toBe(0);
  expect(comparisonSchema.safeParse({...enough,similarity:null}).success).toBe(false);
 });
 it("strips unapproved private fields and rejects inconsistent summaries",()=>{
  const value=comparisonSchema.parse({...small,peerTotal:100,privateNote:"secret",profile:{...profile,email:"secret"},items:[{...item,otherNote:"secret",work:{...work,hidden:true}}]});
  expect(JSON.stringify(value)).not.toContain("secret");expect(value).not.toHaveProperty("peerTotal");
  expect(value.items[0]?.work).not.toHaveProperty("hidden");
  for(const patch of [{tierCount:2},{commonSCount:2},{differentCount:1},{confidence:1},{hasNext:true},{items:[]}])
   expect(comparisonSchema.safeParse({...small,...patch}).success).toBe(false);
  expect(comparisonSchema.safeParse({...small,section:"different",commonSCount:0,differentCount:1}).success).toBe(false);
 });
 it("uses bounded, strict input and resets pagination on section changes",()=>{
  expect(parseComparisonSearch({})).toEqual({section:"all",page:1});
  expect(comparisonUrl("reader_two","different",3)).toBe("/compare/reader_two?section=different&page=3");
  expect(comparisonUrl("reader_two","common_s")).toBe("/compare/reader_two?section=common_s");
  for(const query of [{page:"0"},{page:"1001"},{page:["1","2"]},{section:["all","common_s"]},{viewerId:profile.id},{section:"unknown"}])
   expect(()=>parseComparisonSearch(query)).toThrow();
  expect(comparisonInputSchema.safeParse({username:"reader_two",section:"all",page:1,viewerId:profile.id}).success).toBe(false);
 });
 it("describes sample boundaries without a statistical guarantee",()=>{
  expect([0,4,5,9,10,29,30].map(comparisonSampleLabel)).toEqual(["표본 부족","표본 부족","적은 표본","적은 표본","보통 표본","보통 표본","많은 표본"]);
 });
});
