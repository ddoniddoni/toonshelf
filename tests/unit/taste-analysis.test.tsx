import { afterEach,describe,expect,it,vi } from "vitest";
import { cleanup,render,screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { tasteAnalysisSchema,ratingSummary,type TasteAnalysis } from "@/lib/discovery/analysis-model";
import { TasteAnalysisView } from "@/components/discovery/taste-analysis";
vi.mock("next/link",()=>({default:({children,href}:{children:ReactNode;href:string})=><a href={href}>{children}</a>}));
afterEach(cleanup);
const empty:TasteAnalysis={viewerId:"45000000-0000-4000-8000-000000000001",computedAt:"2026-10-12T00:00:00Z",totalCount:0,readCount:0,statuses:{},ratings:{},tiers:{},genres:[],platforms:[]};
const category={id:null,name:"미분류",weight:1,workCount:1,share:1};
const one:TasteAnalysis={...empty,totalCount:2,readCount:1,statuses:{completed:1,planned:1},ratings:{"7":1},tiers:{S:1},genres:[category],platforms:[category]};
describe("private taste analysis contract",()=>{
 it("accepts empty and weighted data and computes only rated average",()=>{
  expect(tasteAnalysisSchema.safeParse(empty).success).toBe(true);
  expect(tasteAnalysisSchema.safeParse(one).success).toBe(true);
  expect(ratingSummary(one.ratings)).toEqual({count:1,average:3.5});
  expect(ratingSummary({})).toEqual({count:0,average:null});
 });
 it("rejects unknown counts, inconsistent totals, duplicate categories and invalid weights",()=>{
  for(const data of [{...one,statuses:{other:2}}, {...one,readCount:2}, {...one,ratings:{"11":1}},
   {...one,tiers:{S:2}}, {...one,genres:[category,category]},
   {...one,genres:[{...category,share:.5}]}, {...one,platforms:[{...category,weight:2}]},
   {...one,platforms:[]}])expect(tasteAnalysisSchema.safeParse(data).success).toBe(false);
 });
 it("splits one work across categories and strips unsolicited private fields",()=>{
  const genres=[1,2].map(n=>({...category,id:`49000000-0000-4000-8000-00000000000${n}`,name:`장르${n}`,weight:.5,share:.5}));
  const parsed=tasteAnalysisSchema.parse({...one,genres,privateNotes:"not in DTO"});
  expect(parsed.genres).toHaveLength(2);expect(parsed).not.toHaveProperty("privateNotes");
 });
 it("distinguishes no library, planned-only and no ratings",()=>{
  const {rerender}=render(<TasteAnalysisView result={empty}/>);
  expect(screen.getByText("아직 분석할 서재 기록이 없어요")).toBeTruthy();
  rerender(<TasteAnalysisView result={{...empty,totalCount:1,statuses:{planned:1}}}/>);
  expect(screen.getByRole("status").textContent).toContain("읽을 예정");
  expect(screen.getByText("아직 별점을 남긴 작품이 없어요.")).toBeTruthy();
  rerender(<TasteAnalysisView result={one}/>);
  expect(screen.getByText("3.50")).toBeTruthy();
  expect(screen.getByText(/실제로 읽은 서비스나 결제한 플랫폼을 뜻하지 않아요/)).toBeTruthy();
 });
});
