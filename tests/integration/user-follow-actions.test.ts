// @vitest-environment node
// Mocked action/DAL boundaries only; not live Auth, SQL or RLS verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),revalidate:vi.fn(),env:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:mocks.env}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { AuthFailure } from "@/lib/auth/errors";
import { setUserFollow,reloadUserFollow } from "@/lib/social/actions";
import { listPublicFollows } from "@/lib/social/data";
const id="32000000-0000-4000-8000-000000000002";
const state={id,username:"reader_two",name:"독자",avatarPath:null,followerCount:1,followingCount:0,following:true,canFollow:true,isSelf:false};
describe("user follow server boundaries (written only)",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.env.mockReturnValue({supabase:{url:"https://example.test",key:"public"}});mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:state,error:null});});
 it("requires an active member and refuses client-controlled ownership",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","정지 계정"));
  expect(await setUserFollow({id,following:true})).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
  mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});
  expect(await setUserFollow({id,following:true,followerId:id})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("writes the desired state using the session RPC and invalidates all public relationship routes",async()=>{
  expect(await setUserFollow({id,following:true})).toEqual({ok:true,state});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_set_user_follow",{p_user:id,p_following:true});
  expect(mocks.revalidate.mock.calls).toEqual([["/u/[username]","page"],["/u/[username]/followers","page"],["/u/[username]/following","page"],["/me/feed"],["/me/notifications"]]);
 });
 it("accepts removal of an inaccessible target and never invents a successful new follow",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});
  expect(await setUserFollow({id,following:false})).toEqual({ok:true,state:null});
  mocks.revalidate.mockClear();
  expect(await setUserFollow({id,following:true})).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("requires the returned target/desired flag to match and conceals raw database details",async()=>{
  for (const data of [{...state,id:"32000000-0000-4000-8000-000000000003"},{...state,following:false},{...state,followerCount:"invalid"}]) {
   mocks.rpc.mockResolvedValue({data,error:null});expect(await setUserFollow({id,following:true})).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});
  }
  for (const [error,code] of [[{message:"SELF_FOLLOW"},"FORBIDDEN"],[{message:"NOT_FOUND"},"NOT_FOUND"],[{message:"RATE_LIMITED"},"RATE_LIMITED"],[{code:"57014",message:"secret SQL"},"CONFLICT"],[{message:"private SQL",details:"secret"},"INTERNAL_ERROR"]] as const) {
   mocks.rpc.mockResolvedValue({data:null,error});const reply=await setUserFollow({id,following:true});
   expect(reply).toMatchObject({ok:false,error:{code}});expect(JSON.stringify(reply)).not.toMatch(/secret|private SQL/);
  }
  expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("reads anonymous-safe projections without admin keys and strips nonpublic fields",async()=>{
  mocks.rpc.mockResolvedValue({data:{...state,following:false,canFollow:false,email:"secret"},error:null});
  expect(await reloadUserFollow({username:state.username})).toEqual({ok:true,state:{...state,following:false,canFollow:false}});
  expect(mocks.account).not.toHaveBeenCalled();expect(mocks.rpc).toHaveBeenCalledWith("toon_get_public_follow_state",{p_username:state.username});
  const list={profile:state,kind:"followers",page:2,total:1,hasNext:false,items:[]};
  mocks.rpc.mockResolvedValue({data:list,error:null});expect(await listPublicFollows(state.username,"followers",2)).toEqual(list);
  expect(mocks.rpc).toHaveBeenLastCalledWith("toon_list_public_follows",{p_username:state.username,p_kind:"followers",p_page:2});
 });
 it("rejects a mismatched list projection instead of serving another route's data",async()=>{
  mocks.rpc.mockResolvedValue({data:{profile:state,kind:"following",page:1,total:0,hasNext:false,items:[]},error:null});
  await expect(listPublicFollows(state.username,"followers",2)).rejects.toMatchObject({code:"INTERNAL_ERROR"});
 });
});
