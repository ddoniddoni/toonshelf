// @vitest-environment node
// Written mocked boundaries only; no live DB/Auth/RLS verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { setTierLike,reloadTierLike } from "@/lib/tiers/like-actions";
import { AuthFailure } from "@/lib/auth/errors";
const id="20000000-0000-4000-8000-000000000001",input={id,version:2,liked:true};
const state={id,version:2,likeCount:1,liked:true,canLike:true};
describe("tier like action boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:state,error:null});});
 it("checks the current active account before mutation and rejects injected ownership/counts",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","정지 계정"));expect(await setTierLike(input)).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
  mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});expect(await setTierLike({...input,userId:id,likeCount:100})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("sends desired state/expected lifecycle version without an actor and revalidates current counts",async()=>{
  expect(await setTierLike(input)).toEqual({ok:true,state});expect(mocks.rpc).toHaveBeenCalledWith("set_tier_like",{p_id:id,p_version:2,p_liked:true});
  expect(mocks.revalidate.mock.calls).toEqual([["/tiers"],[`/tiers/${id}`]]);
  mocks.rpc.mockResolvedValue({data:{...state,liked:false,likeCount:0},error:null});expect(await setTierLike({...input,liked:false})).toMatchObject({ok:true,state:{liked:false,likeCount:0}});
 });
 it("maps self/stale/withdrawn/rate errors without exposing raw database details",async()=>{
  for (const [message,code] of [["SELF_REACTION","FORBIDDEN"],["CONFLICT","CONFLICT"],["NOT_FOUND","NOT_FOUND"],["RATE_LIMITED","RATE_LIMITED"],["private SQL","INTERNAL_ERROR"]]) {
   mocks.rpc.mockResolvedValue({data:null,error:{message,details:"secret"}});const reply=await setTierLike(input);
   expect(reply).toMatchObject({ok:false,error:{code}});expect(JSON.stringify(reply)).not.toMatch(/secret|private SQL/);
  }
  expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("allows anonymous state reads through the public projection and returns no identities",async()=>{
  mocks.rpc.mockResolvedValue({data:{...state,liked:false,canLike:false,likers:["private-member"]},error:null});
  const reply=await reloadTierLike({id});expect(reply).toMatchObject({ok:true,state:{likeCount:1,liked:false,canLike:false}});
  expect(mocks.account).not.toHaveBeenCalled();expect(mocks.rpc).toHaveBeenCalledWith("get_tier_like_state",{p_id:id});expect(JSON.stringify(reply)).not.toContain("private-member");
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await reloadTierLike({id})).toMatchObject({ok:false,error:{code:"NOT_FOUND"}});
 });
});
