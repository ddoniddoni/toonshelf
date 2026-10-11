import { afterEach,describe,expect,it,vi } from "vitest";
import { cleanup,render,screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { parseRankingFilters,rankingsSchema,rankingsUrl,type Rankings } from "@/lib/discovery/rankings-model";
import { WorkRankings,RankingFiltersForm } from "@/components/discovery/work-rankings";
vi.mock("next/link",()=>({default:({children,href,...props}:{children:ReactNode;href:string;prefetch?:boolean})=>{const {prefetch,...rest}=props;void prefetch;return <a href={href} {...rest}>{children}</a>;}}));
vi.mock("@/components/catalogue/work-card",()=>({WorkCard:({work}:{work:{title:string}})=><article>{work.title}</article>}));
afterEach(cleanup);
const work={id:"53000000-0000-4000-8000-000000000001",slug:"ranking-one",title:"작품 하나",aliases:[],serialStatus:"ongoing" as const,ageRating:"all" as const,createdAt:"2026-10-12T00:00:00Z",coverAssetId:null,coverAttribution:"",creators:[],genres:[],platforms:[]};
const result:Rankings={...parseRankingFilters({}),computedAt:"2026-10-12T00:00:00Z",total:1,hasNext:false,items:[{work,sampleCount:5,rank:1,average:5}]};
describe("work ranking contract and presentation",()=>{
 it("parses filters and rejects duplicate/invalid input",()=>{
  expect(parseRankingFilters({audience:"completed_experienced",page:"2"})).toMatchObject({audience:"completed_experienced",page:2});
  for(const query of [{page:"0"},{page:"1001"},{page:"1.5"},{audience:["all","completed"]},{audience:"private"},{genre:"../"}])expect(()=>parseRankingFilters(query)).toThrow();
 });
 it("keeps only filter fields when generating a link from a full response",()=>{
  const url=rankingsUrl(result,{section:"insufficient",page:1});
  expect(url).toContain("section=insufficient");expect(url).not.toContain("computedAt");
 });
 it("accepts five ratings and suppresses all subthreshold scores",()=>{
  expect(rankingsSchema.safeParse(result).success).toBe(true);
  const insufficient={...result,section:"insufficient",items:[{work,sampleCount:4,rank:null,average:null}]};
  expect(rankingsSchema.safeParse(insufficient).success).toBe(true);
  expect(rankingsSchema.safeParse({...insufficient,items:[{work,sampleCount:4,rank:null,average:5}]}).success).toBe(false);
  expect(rankingsSchema.safeParse({...result,items:[{work,sampleCount:4,rank:1,average:5}]}).success).toBe(false);
 });
 it("rejects duplicate works, wrong rank and pagination totals",()=>{
  for(const value of [{...result,total:2,items:[...result.items,...result.items]}, {...result,hasNext:true}, {...result,page:2}, {...result,items:[{...result.items[0],rank:2}]}])expect(rankingsSchema.safeParse(value).success).toBe(false);
 });
 it("renders raw average, insufficient count and no invented empty rankings",()=>{
  const {rerender}=render(<WorkRankings result={result}/>);
  expect(screen.getByText("공개 평가 5건 · 평균 5.00점")).toBeTruthy();
  rerender(<WorkRankings result={{...result,section:"insufficient",items:[{work,sampleCount:4,rank:null,average:null}]}}/>);
  expect(screen.getByText("공개 평가 4건")).toBeTruthy();expect(screen.queryByText(/평균 5.00점/)).toBeNull();
  rerender(<WorkRankings result={{...result,total:0,items:[]}}/>);
  expect(screen.getByRole("status").textContent).toContain("표본이 부족");
 });
 it("resets page when applying labeled filters",()=>{
  const {container}=render(<RankingFiltersForm filters={{...result,page:3}} options={null}/>);
  expect(screen.getByLabelText("평가 대상")).toBeTruthy();expect(container.querySelector('[name="page"]')).toBeNull();
 });
});
