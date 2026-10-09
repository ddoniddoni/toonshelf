// @vitest-environment node
// Mocked DAL contracts only; not proof of live sessions, RLS or performance.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({client:vi.fn(),rpc:vi.fn(),env:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:mocks.env}));
import { getSharedSRecommendations } from "@/lib/discovery/shared-s-data";
const workId="59000000-0000-4000-8000-000000000001";
const empty={workId,computedAt:"2026-10-10T00:00:00Z",items:[]};
describe("shared S recommendation DAL",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.env.mockReturnValue({supabase:{}});mocks.client.mockResolvedValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:empty,error:null});});
 it("validates input before creating a request client and accepts no viewer injection",async()=>{
  await expect(getSharedSRecommendations({workId,viewerId:workId})).rejects.toThrow();
  await expect(getSharedSRecommendations({workId:"invalid"})).rejects.toThrow();expect(mocks.client).not.toHaveBeenCalled();
  expect(await getSharedSRecommendations({workId})).toEqual(empty);
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_shared_s_recommendations",{p_work:workId});
 });
 it("preserves unavailable results and rejects results for a different work",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:null});expect(await getSharedSRecommendations({workId})).toBeNull();
  mocks.rpc.mockResolvedValueOnce({data:{...empty,workId:"59000000-0000-4000-8000-000000000002"},error:null});
  await expect(getSharedSRecommendations({workId})).rejects.toMatchObject({code:"INTERNAL_ERROR"});
 });
 it("does not retry with anonymous or privileged access on a rejected session",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{message:"FORBIDDEN"}});
  await expect(getSharedSRecommendations({workId})).rejects.toMatchObject({code:"FORBIDDEN"});expect(mocks.rpc).toHaveBeenCalledTimes(1);
 });
 it("keeps unavailable API, timeout and empty samples distinct without logging raw SQL",async()=>{
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  try {
   for(const code of ["PGRST202","PGRST205","42883","42P01"]) {
    mocks.rpc.mockResolvedValue({data:null,error:{code,message:"private SQL"}});
    await expect(getSharedSRecommendations({workId})).rejects.toMatchObject({code:"CONFIG_REQUIRED"});
   }
   mocks.rpc.mockResolvedValue({data:null,error:{code:"57014"}});
   await expect(getSharedSRecommendations({workId})).rejects.toMatchObject({code:"CONFLICT"});
   mocks.env.mockReturnValue({supabase:null});await expect(getSharedSRecommendations({workId})).rejects.toMatchObject({code:"CONFIG_REQUIRED"});
   expect(log).not.toHaveBeenCalled();
  } finally {log.mockRestore();}
 });
});
