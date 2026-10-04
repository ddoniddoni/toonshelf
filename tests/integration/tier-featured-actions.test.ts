// @vitest-environment node
// Written mocked boundaries only; no live Auth/RLS/concurrency verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),revalidate:vi.fn(),env:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:mocks.env}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { setFeaturedTier } from "@/lib/tiers/featured-actions";
import { getMyFeaturedTierState,getPublicFeaturedTier } from "@/lib/tiers/featured-data";
import { AuthFailure } from "@/lib/auth/errors";
const id="20000000-0000-4000-8000-000000000001",input={id,tierVersion:2,featuredVersion:1};
const card={id,version:2,publishedVersion:1,publishedAt:"2026-10-05T00:00:00Z",authorId:id,username:"author",name:"작성자",isSpoiler:true,title:null,tags:null,likeCount:0,recentLikeCount:0};
describe("featured owner and public boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.env.mockReturnValue({supabase:{}});mocks.rpc.mockResolvedValue({data:{id,version:2},error:null});});
 it("requires an active account and rejects injected actors",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("AUTH_REQUIRED","로그인"));expect(await setFeaturedTier(input)).toMatchObject({ok:false,error:{code:"AUTH_REQUIRED"}});
  mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});expect(await setFeaturedTier({...input,userId:id})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("sends separate expected revisions and invalidates owner/visitor pages after acknowledgement",async()=>{
  expect(await setFeaturedTier(input)).toEqual({ok:true,state:{id,version:2}});
  expect(mocks.rpc).toHaveBeenCalledWith("set_featured_tier",{p_id:id,p_tier_version:2,p_featured_version:1});
  expect(mocks.revalidate.mock.calls).toEqual([["/u/[username]","page"],["/me/tiers"],["/tiers/[id]/publish","page"]]);
  mocks.rpc.mockResolvedValue({data:{id:null,version:3},error:null});expect(await setFeaturedTier({id:null,tierVersion:null,featuredVersion:2})).toEqual({ok:true,state:{id:null,version:3}});
 });
 it("maps stale/unavailable/ownership errors without private DB details or successful invalidation",async()=>{
  for (const [message,code] of [["CONFLICT","CONFLICT"],["FEATURED_UNAVAILABLE","FORBIDDEN"],["NOT_FOUND","NOT_FOUND"],["RATE_LIMITED","RATE_LIMITED"],["private SQL","INTERNAL_ERROR"]]) {
   mocks.rpc.mockResolvedValue({data:null,error:{message,details:"secret"}});const reply=await setFeaturedTier(input);
   expect(reply).toMatchObject({ok:false,error:{code}});expect(JSON.stringify(reply)).not.toMatch(/secret|private SQL/);
  }
  expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("reads owner revisions only through the authenticated RPC",async()=>{
  expect(await getMyFeaturedTierState()).toEqual({id,version:2});expect(mocks.account).toHaveBeenCalled();expect(mocks.rpc).toHaveBeenCalledWith("get_my_featured_tier_state");
 });
 it("reads a visitor-safe current card without requiring login or exposing owner state",async()=>{
  mocks.rpc.mockResolvedValue({data:{...card,featuredVersion:10,body:{title:"private"},token:"secret"},error:null});
  expect(await getPublicFeaturedTier("author")).toEqual(card);expect(mocks.account).not.toHaveBeenCalled();expect(mocks.rpc).toHaveBeenCalledWith("get_public_featured_tier",{p_username:"author"});
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await getPublicFeaturedTier("author")).toBeNull();
  mocks.env.mockReturnValue({supabase:null});mocks.rpc.mockClear();expect(await getPublicFeaturedTier("author")).toBeNull();expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("rejects invalid usernames and unsafe spoiler metadata",async()=>{
  await expect(getPublicFeaturedTier("invalid/name")).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({data:{...card,title:"spoiler-secret"},error:null});await expect(getPublicFeaturedTier("author")).rejects.toThrow();
 });
});
