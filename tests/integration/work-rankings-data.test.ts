// @vitest-environment node
// Written only: mocks do not verify live sessions, RLS, or performance.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({client:vi.fn(),rpc:vi.fn(),env:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:mocks.env}));
import { getWorkRankings } from "@/lib/discovery/rankings-data";
import { parseRankingFilters } from "@/lib/discovery/rankings-model";
const filters=parseRankingFilters({});
const empty={...filters,computedAt:"2026-10-12T00:00:00Z",total:0,hasNext:false,items:[]};
describe("ranking DAL",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.env.mockReturnValue({supabase:{url:"https://example.test"}});mocks.client.mockResolvedValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:empty,error:null});});
 it("uses request client and explicitly forwards validated filters",async()=>{
  expect(await getWorkRankings(filters)).toEqual(empty);
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_work_rankings",{p_audience:"all",p_platform:null,p_genre:null,p_section:"ranked",p_page:1});
 });
 it("rejects another filter envelope and malformed success",async()=>{
  for(const data of [null,{...empty,audience:"completed"},{...empty,total:1}]) {
   mocks.rpc.mockResolvedValueOnce({data,error:null});await expect(getWorkRankings(filters)).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  }
 });
 it("does not return empty ranks for unavailable API, timeout or auth rejection",async()=>{
  for(const code of ["PGRST202","PGRST205","42883","42P01","57014"]) {
   mocks.rpc.mockResolvedValueOnce({data:null,error:{code}});
   await expect(getWorkRankings(filters)).rejects.toMatchObject({code:code==="57014"?"CONFLICT":"CONFIG_REQUIRED"});
  }
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"AUTH_REQUIRED"}});
  await expect(getWorkRankings(filters)).rejects.toMatchObject({code:"AUTH_REQUIRED"});
  expect(mocks.rpc).toHaveBeenCalledTimes(6);
 });
 it("does not query unconfigured environments or invalid inputs",async()=>{
  mocks.env.mockReturnValueOnce({supabase:null});await expect(getWorkRankings(filters)).rejects.toMatchObject({code:"CONFIG_REQUIRED"});
  await expect(getWorkRankings({...filters,page:0})).rejects.toThrow();expect(mocks.client).not.toHaveBeenCalled();
 });
});
