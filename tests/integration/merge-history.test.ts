// @vitest-environment node
// Mock boundaries only. Live ownership/RLS/locking checks remain unexecuted.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),redirect:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import { getMyMergeHistory,getMyMergedWorkTarget } from "@/lib/library/merge-history";
import { deleteMergeHistory } from "@/lib/library/merge-history-actions";
import { AuthFailure } from "@/lib/auth/errors";
const id = "10000000-0000-4000-8000-000000000001";
const form = (confirm = "on")=>{const f = new FormData();f.set("id",id);f.set("userId","victim");f.set("confirm",confirm);return f;};
describe("owner-only merge history",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:{items:[],total:0,hasNext:false},error:null});mocks.redirect.mockImplementation(()=>{throw new Error("NEXT_REDIRECT");});});
 it("uses current account gates for original notes and never accepts an owner parameter",async()=>{
  await getMyMergeHistory(1);expect(mocks.rpc).toHaveBeenCalledWith("toon_get_my_work_merge_history",{p_page:1});
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","권한 없음"));
  await expect(getMyMergeHistory(1)).rejects.toMatchObject({code:"FORBIDDEN"});
 });
 it("requires confirmation before deleting a preserved original",async()=>{
  expect(await deleteMergeHistory(null,form(""))).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("only forwards history ID and confirmation, then refreshes owner history",async()=>{
  await expect(deleteMergeHistory(null,form())).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.rpc).toHaveBeenCalledWith("toon_delete_my_work_merge_history",{p_id:id,p_confirm:true});expect(mocks.revalidate).toHaveBeenCalledWith("/me/library/merges");
 });
 it("cannot redirect an unrelated missing library entry",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await getMyMergedWorkTarget(id)).toBeNull();
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_my_work_merge_target",{p_source:id});
 });
 it("does not expose private SQL errors or redirect after a failed delete",async()=>{
  mocks.rpc.mockResolvedValue({error:{code:"XX000",message:"private-note-secret"}});
  const result = await deleteMergeHistory(null,form());expect(result).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});
  expect(JSON.stringify(result)).not.toContain("private-note-secret");expect(mocks.redirect).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled();
 });
});
