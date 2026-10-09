import { render,screen,cleanup } from "@testing-library/react";
import { afterEach,describe,expect,it,vi } from "vitest";
import type { PropsWithChildren } from "react";
vi.mock("next/link",()=>({default:({children,href}:PropsWithChildren<{href:string}>)=><a href={href}>{children}</a>}));
import { TasteComparisonResult } from "@/components/discovery/taste-comparison";
import type { TasteComparison } from "@/lib/discovery/comparison-model";
const empty:TasteComparison={profile:{id:"38000000-0000-4000-8000-000000000002",username:"reader_two",name:"비교 회원"},commonCount:0,tierCount:0,ratingCount:0,commonSCount:0,differentCount:0,similarity:null,confidence:0,section:"all",page:1,hasNext:false,items:[]};
describe("taste comparison presentation (not executed)",()=>{
 afterEach(cleanup);
 it("shows insufficient data without a fabricated score or meter",()=>{
  render(<TasteComparisonResult comparison={empty}/>);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  expect(screen.getByText(/점수는 비교 가능한 공통 작품이 5편 이상/)).toBeInTheDocument();
  expect(screen.getByRole("link",{name:/내 서재에서 평가/})).toHaveAttribute("href","/me/library");
 });
 it("renders a real zero and keeps the chosen section in pagination",()=>{
  const items:TasteComparison["items"]=Array.from({length:20},(_,n)=>({work:{id:`58000000-0000-4000-8000-${String(n+1).padStart(12,"0")}`,slug:`work-${n+1}`,title:`작품 ${n+1}`},signal:"tier",mine:"S",other:"F",difference:1}));
  render(<TasteComparisonResult comparison={{...empty,commonCount:41,tierCount:41,differentCount:41,similarity:0,confidence:41/51,section:"different",page:2,hasNext:true,items}}/>);
  expect(screen.getByRole("meter")).toHaveAttribute("value","0");
  expect(screen.getByRole("link",{name:"다음"})).toHaveAttribute("href","/compare/reader_two?section=different&page=3");
  expect(screen.getByRole("link",{name:/함께 S인 작품/})).toHaveAttribute("href","/compare/reader_two?section=common_s");
  expect(screen.getByText(/내 비공개 평가도 포함될 수 있어요/)).toBeInTheDocument();
 });
});
