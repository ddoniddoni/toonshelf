import { render,screen } from "@testing-library/react";
import { describe,expect,it,vi } from "vitest";
import type { PropsWithChildren } from "react";
vi.mock("next/link",()=>({default:({children,href}:PropsWithChildren<{href:string}>)=><a href={href}>{children}</a>}));
vi.mock("@/components/catalogue/work-card",()=>({WorkCard:({work}:{work:{title:string}})=><h3>{work.title}</h3>}));
import { SharedSRecommendationList } from "@/components/discovery/shared-s-recommendations";
import type { SharedSRecommendations } from "@/lib/discovery/shared-s-model";
const empty:SharedSRecommendations={workId:"59000000-0000-4000-8000-000000000001",computedAt:"2026-10-10T00:00:00Z",items:[]};
describe("shared S recommendation explanation (written only)",()=>{
 it("offers exploration for insufficient data without fake recommendations",()=>{
  render(<SharedSRecommendationList result={empty}/>);
  expect(screen.getByText("아직 추천 기준을 충족한 작품이 없어요.")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:/작품 탐색/})).toHaveAttribute("href","/explore");
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
 });
 it("shows actual sample evidence and calculation time, not an affinity probability",()=>{
  const {container}=render(<SharedSRecommendationList result={{...empty,items:[{work:{id:"59000000-0000-4000-8000-000000000002",slug:"candidate-work",title:"추천 작품",aliases:[],serialStatus:"ongoing",ageRating:"all",createdAt:empty.computedAt,coverAssetId:null,coverAttribution:"",creators:[],genres:[],platforms:[]},sampleCount:5,sharedSCount:3,coSRatio:0.6,rankingScore:0.2}]}}/>);
  expect(screen.getByText(/공동 평가 5명 중/)).toBeInTheDocument();expect(screen.getByText("3명이 이 작품도 S")).toBeInTheDocument();
  expect(screen.getByText(/전체 독자의 선호 확률은 아니에요/)).toBeInTheDocument();
  expect(container.querySelector("time")).toHaveAttribute("dateTime",empty.computedAt);
 });
});
