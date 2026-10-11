// @vitest-environment node
// Written only: mocked DAL, not proof of actual sessions/RLS.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
import { getPersonalRecommendations } from "@/lib/discovery/personal-data";
const viewerId="60000000-0000-4000-8000-000000000001";
const empty={viewerId,computedAt:"2026-10-12T00:00:00Z",ownEvaluationCount:0,mode:"empty",reason:"insufficient_evaluations",items:[]};
describe("personal recommendations DAL",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({user:{id:viewerId},client:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:empty,error:null});});
 it("uses only the current account client, without caller identity parameters",async()=>{
  expect(await getPersonalRecommendations()).toEqual(empty);
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_personal_recommendations");
 });
 it("rejects another viewer's result and malformed success",async()=>{
  for(const data of [null,{}, {...empty,viewerId:"60000000-0000-4000-8000-000000000002"}]) {
   mocks.rpc.mockResolvedValueOnce({data,error:null});
   await expect(getPersonalRecommendations()).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  }
 });
 it("requires membership before querying and never retries anonymously",async()=>{
  mocks.account.mockRejectedValueOnce(new Error("membership rejected"));
  await expect(getPersonalRecommendations()).rejects.toThrow("membership rejected");expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"FORBIDDEN"}});
  await expect(getPersonalRecommendations()).rejects.toMatchObject({code:"FORBIDDEN"});expect(mocks.rpc).toHaveBeenCalledTimes(1);
 });
 it("distinguishes missing RPC and timeout from an empty sample",async()=>{
  for(const code of ["PGRST202","PGRST205","42883","42P01"]) {
   mocks.rpc.mockResolvedValueOnce({data:null,error:{code,message:"private SQL"}});
   await expect(getPersonalRecommendations()).rejects.toMatchObject({code:"CONFIG_REQUIRED"});
  }
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"57014"}});
  await expect(getPersonalRecommendations()).rejects.toMatchObject({code:"CONFLICT"});
 });
});
