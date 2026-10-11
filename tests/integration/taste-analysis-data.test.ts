// @vitest-environment node
// Written only; mocked DAL is not live Auth/RLS verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
import { getTasteAnalysis } from "@/lib/discovery/analysis-data";
const viewerId="45000000-0000-4000-8000-000000000001";
const empty={viewerId,computedAt:"2026-10-12T00:00:00Z",totalCount:0,readCount:0,statuses:{},ratings:{},tiers:{},genres:[],platforms:[]};
describe("taste analysis DAL",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({user:{id:viewerId},client:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:empty,error:null});});
 it("uses current account without any caller-selected identity",async()=>{
  expect(await getTasteAnalysis()).toEqual(empty);expect(mocks.rpc).toHaveBeenCalledWith("toon_get_my_taste_analysis");
 });
 it("rejects another viewer and malformed results",async()=>{
  for(const data of [null,{...empty,totalCount:1},{...empty,viewerId:"45000000-0000-4000-8000-000000000002"}]) {
   mocks.rpc.mockResolvedValueOnce({data,error:null});await expect(getTasteAnalysis()).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  }
 });
 it("requires membership without anonymous fallback",async()=>{
  mocks.account.mockRejectedValueOnce(new Error("denied"));await expect(getTasteAnalysis()).rejects.toThrow("denied");expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("does not disguise missing RPC or timeout as zero records",async()=>{
  for(const code of ["PGRST202","PGRST205","42883","42P01","57014"]) {
   mocks.rpc.mockResolvedValueOnce({data:null,error:{code}});
   await expect(getTasteAnalysis()).rejects.toMatchObject({code:code==="57014"?"CONFLICT":"CONFIG_REQUIRED"});
  }
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"FORBIDDEN"}});
  await expect(getTasteAnalysis()).rejects.toMatchObject({code:"FORBIDDEN"});
 });
});
