// @vitest-environment node
// Written only: mocked DAL contracts do not establish live RLS/session behavior.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
import { getTasteComparison } from "@/lib/discovery/comparison-data";
import { AuthFailure } from "@/lib/auth/errors";
const me="38000000-0000-4000-8000-000000000001";
const input={username:"reader_two",section:"all",page:1};
const empty={profile:{id:"38000000-0000-4000-8000-000000000002",username:"reader_two",name:"비교 회원"},
 commonCount:0,tierCount:0,ratingCount:0,commonSCount:0,differentCount:0,similarity:null,confidence:0,section:"all",page:1,hasNext:false,items:[]};
describe("taste comparison session boundary",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc},user:{id:me}});mocks.rpc.mockResolvedValue({data:empty,error:null});});
 it("requires an account, rejects an injected actor and uses only its session",async()=>{
  mocks.account.mockRejectedValueOnce(new AuthFailure("AUTH_REQUIRED","로그인 필요"));
  await expect(getTasteComparison(input)).rejects.toMatchObject({code:"AUTH_REQUIRED"});
  await expect(getTasteComparison({...input,viewerId:me})).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled();
  expect(await getTasteComparison(input)).toEqual(empty);
  expect(mocks.rpc).toHaveBeenCalledWith("toon_compare_taste",{p_username:"reader_two",p_section:"all",p_page:1});
 });
 it("rejects the wrong returned identity or page and preserves unavailable results",async()=>{
  for(const patch of [{profile:{...empty.profile,id:me}},{profile:{...empty.profile,username:"someone_else"}},{page:2},{section:"different"}]) {
   mocks.rpc.mockResolvedValue({data:{...empty,...patch},error:null});
   await expect(getTasteComparison(input)).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  }
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await getTasteComparison(input)).toBeNull();
 });
 it("handles missing APIs and self comparison without logging SQL details",async()=>{
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  try {
   for(const code of ["PGRST202","PGRST205","42883","42P01"]) {
    mocks.rpc.mockResolvedValue({data:null,error:{code,message:"private DB detail"}});
    await expect(getTasteComparison(input)).rejects.toMatchObject({code:"CONFIG_REQUIRED"});
   }
   mocks.rpc.mockResolvedValue({data:null,error:{message:"SELF_COMPARE"}});
   await expect(getTasteComparison(input)).rejects.toMatchObject({code:"VALIDATION_ERROR"});
   expect(log).not.toHaveBeenCalled();
  } finally {log.mockRestore();}
 });
});
