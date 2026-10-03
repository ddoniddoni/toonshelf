// @vitest-environment node
// Mock action boundaries only; no live Supabase/Auth/RLS verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { saveTierDraft,saveTierAsNew,searchTierWorks } from "@/lib/tiers/actions";
import { defaultDraft } from "@/lib/tiers/model";
import { AuthFailure } from "@/lib/auth/errors";
const id="20000000-0000-4000-8000-000000000001";let n=0;const draft=defaultDraft(()=>`10000000-0000-4000-8000-${String(++n).padStart(12,"0")}`);
describe("tier owner action boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});});
 it("gates an inactive account before RPC and rejects injected ownership fields",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","정지 계정"));expect(await saveTierDraft({tierListId:id,expectedVersion:1,draft})).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
  mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});expect(await saveTierDraft({tierListId:id,expectedVersion:1,draft,userId:"victim"})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("returns only safe conflict metadata and does not invalidate or overwrite the editor",async()=>{
  mocks.rpc.mockResolvedValue({error:null,data:{ok:false,conflict:{version:2,savedAt:"later",privateNote:"secret"},draft:{title:"someone else's edit"}}});
  const reply=await saveTierDraft({tierListId:id,expectedVersion:1,draft});expect(reply).toMatchObject({ok:false,conflict:{version:2,savedAt:"later"}});
  expect(JSON.stringify(reply)).not.toMatch(/secret|someone/);expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("passes expected version and full validated draft without resetting a live editor through revalidation",async()=>{
  mocks.rpc.mockResolvedValue({error:null,data:{ok:true,version:2,savedAt:"saved",draft,works:[]}});
  expect(await saveTierDraft({tierListId:id,expectedVersion:1,draft})).toMatchObject({ok:true,version:2});
  expect(mocks.rpc).toHaveBeenCalledWith("save_tier_draft",{p_id:id,p_version:1,p_draft:draft});expect(mocks.revalidate.mock.calls).toEqual([["/me/tiers"]]);
 });
 it("binds conflict copies to an owned origin and strips database error details",async()=>{
  mocks.rpc.mockResolvedValue({error:null,data:id});expect(await saveTierAsNew({origin:id,draft})).toEqual({ok:true,id});
  expect(mocks.rpc).toHaveBeenCalledWith("create_tier_draft",{p_origin:id,p_draft:draft});
  mocks.rpc.mockResolvedValue({error:{message:"private SQL evidence",details:"secret"}});const reply=await searchTierWorks({origin:"library",q:"",page:1});
  expect(reply).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});expect(JSON.stringify(reply)).not.toMatch(/evidence|secret/);
 });
});
