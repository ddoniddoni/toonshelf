import { render,screen,cleanup } from "@testing-library/react";
import { afterEach,describe,expect,it,vi } from "vitest";
import type { PropsWithChildren } from "react";
import { personalRecommendationsSchema } from "@/lib/discovery/personal-model";
vi.mock("next/link",()=>({default:({children,href}:PropsWithChildren<{href:string}>)=><a href={href}>{children}</a>}));
vi.mock("@/components/catalogue/work-card",()=>({WorkCard:({work}:{work:{title:string}})=><h3>{work.title}</h3>}));
import { PersonalRecommendationList } from "@/components/discovery/personal-recommendations";
const common={viewerId:"60000000-0000-4000-8000-000000000001",computedAt:"2026-10-12T00:00:00Z",ownEvaluationCount:5};
const work={id:"60000000-0000-4000-8000-000000000002",slug:"candidate",title:"추천 작품",aliases:[],serialStatus:"ongoing",ageRating:"all",createdAt:common.computedAt,coverAssetId:null,coverAttribution:"",creators:[],genres:[],platforms:[]};
const item={work,sampleCount:3,score:0.8,minCommonCount:5,maxCommonCount:5};
const collaborative={...common,mode:"collaborative",items:[item]};
afterEach(cleanup);
describe("personal recommendation evidence (written only)",()=>{
 it("accepts exact thresholds and strips unrelated identities",()=>{
  const parsed=personalRecommendationsSchema.parse({...collaborative,neighborIds:["private"],items:[{...item,score:0.6,userIds:["private"]}]});
  expect(JSON.stringify(parsed)).not.toContain("private");
 });
 it("rejects undersized, inconsistent, duplicate and oversized results",()=>{
  for(const patch of [{sampleCount:2},{sampleCount:51},{score:0.59},{score:1.1},{minCommonCount:4},{maxCommonCount:6},{minCommonCount:6}])
   expect(personalRecommendationsSchema.safeParse({...collaborative,items:[{...item,...patch}]}).success).toBe(false);
  expect(personalRecommendationsSchema.safeParse({...collaborative,ownEvaluationCount:4}).success).toBe(false);
  expect(personalRecommendationsSchema.safeParse({...collaborative,items:[item,item]}).success).toBe(false);
  expect(personalRecommendationsSchema.safeParse({...collaborative,items:[]}).success).toBe(false);
  expect(personalRecommendationsSchema.safeParse({...collaborative,items:Array(13).fill(item)}).success).toBe(false);
 });
 it("does not confuse missing evidence with genre recommendations",()=>{
  expect(personalRecommendationsSchema.safeParse({...common,mode:"empty",reason:"insufficient_evaluations",items:[]}).success).toBe(false);
  const result=personalRecommendationsSchema.parse({...common,ownEvaluationCount:0,mode:"genre",reason:"insufficient_evaluations",items:[{work,genres:["판타지"],score:0.99,sampleCount:99}]});
  render(<PersonalRecommendationList result={result}/>);
  expect(screen.getByRole("heading",{name:"장르 기반 추천"})).toBeInTheDocument();
  expect(screen.getByText("관심 장르: 판타지")).toBeInTheDocument();
  expect(screen.queryByText(/99명|99.0\/100/)).not.toBeInTheDocument();
 });
 it("shows actual evidence and timestamp without claiming likelihood",()=>{
  const {container}=render(<PersonalRecommendationList result={personalRecommendationsSchema.parse(collaborative)}/>);
  expect(screen.getByText("취향을 비교한 독자 3명")).toBeInTheDocument();
  expect(screen.getByText(/공통 평가 5편 · 가중 평가 점수 80.0\/100/)).toBeInTheDocument();
  expect(container.querySelector("time")).toHaveAttribute("dateTime",common.computedAt);
 });
 it("keeps empty state useful without fictional work cards",()=>{
  render(<PersonalRecommendationList result={personalRecommendationsSchema.parse({...common,mode:"empty",reason:"no_candidates",items:[]})}/>);
  expect(screen.getByText("아직 개인 추천 기준을 충족한 작품이 없어요.")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:/관심 장르 설정/})).toHaveAttribute("href","/settings/privacy");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
 });
});
