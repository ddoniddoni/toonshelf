import { render,screen } from "@testing-library/react";
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock("@/lib/discovery/shared-s-data",()=>({getSharedSRecommendations:mocks.load}));
vi.mock("@/components/discovery/shared-s-recommendations",()=>({SharedSRecommendationList:()=> <p>recommendation-result</p>}));
import { SharedSPanel } from "@/components/discovery/shared-s-panel";
import { AuthFailure } from "@/lib/auth/errors";
describe("independent recommendation failures",()=>{
 beforeEach(()=>vi.resetAllMocks());
 it("distinguishes preparation from a low sample",async()=>{
  mocks.load.mockRejectedValue(new AuthFailure("CONFIG_REQUIRED","private detail"));
  render(await SharedSPanel({workId:"59000000-0000-4000-8000-000000000001"}));
  expect(screen.getByRole("status")).toHaveTextContent("작품 추천 기능을 준비하고 있어요.");
  expect(screen.queryByText(/추천 기준을 충족/)).not.toBeInTheDocument();
 });
 it("does not expose unexpected database details or break the parent page",async()=>{
  mocks.load.mockRejectedValue(new Error("SQL secret"));
  render(await SharedSPanel({workId:"59000000-0000-4000-8000-000000000001"}));
  expect(screen.getByRole("status")).toHaveTextContent("지금 추천을 불러오지 못했어요.");expect(screen.queryByText(/SQL secret/)).not.toBeInTheDocument();
 });
});
