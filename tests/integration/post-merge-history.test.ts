// @vitest-environment node
// Written only. Does not establish live Auth/RLS or concurrency behavior.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
import { getMyPostMergeHistory } from "@/lib/posts/merge-data";
import { AuthFailure } from "@/lib/auth/errors";
const id="37000000-0000-4000-8000-000000000001",other="37000000-0000-4000-8000-000000000002";
describe("private post work merge history",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:{postId:id,items:[],hasNext:false},error:null});});
 it("requires the current account and never accepts an injected owner",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("AUTH_REQUIRED","로그인 필요"));
  await expect(getMyPostMergeHistory({id,page:1})).rejects.toMatchObject({code:"AUTH_REQUIRED"});
  mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});
  await expect(getMyPostMergeHistory({id,page:1,userId:other})).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("uses the account RPC and validates the returned target",async()=>{
  expect(await getMyPostMergeHistory({id,page:2})).toEqual({postId:id,items:[],hasNext:false});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_my_post_merge_history",{p_id:id,p_page:2});
  mocks.rpc.mockResolvedValue({data:{postId:other,items:[],hasNext:false},error:null});
  await expect(getMyPostMergeHistory({id,page:1})).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await getMyPostMergeHistory({id,page:1})).toBeNull();
 });
 it("treats missing API as preparation without a console error",async()=>{
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  try {mocks.rpc.mockResolvedValue({data:null,error:{code:"PGRST202",details:"private SQL"}});
   await expect(getMyPostMergeHistory({id,page:1})).rejects.toMatchObject({code:"CONFIG_REQUIRED"});expect(log).not.toHaveBeenCalled();
  } finally {log.mockRestore();}
 });
});
