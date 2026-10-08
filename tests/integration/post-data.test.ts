// @vitest-environment node
// Written only; these mocks do not establish real database permissions.
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({rpc:vi.fn(),account:vi.fn(),moderator:vi.fn()}));
vi.mock("react",()=>({cache:(fn:unknown)=>fn}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:()=>({supabase:true})}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/reviews/moderation",()=>({requireModerator:mocks.moderator}));
import { getPost,getMyPostEditor,listPosts } from "@/lib/posts/data";
const id="35000000-0000-4000-8000-000000000001";
const card={id,authorId:id,username:"reader",name:"독자",avatar:null,title:null,excerpt:null,body:null,category:"general",isSpoiler:true,version:2,publishedAt:"2026-10-08T09:00:00Z",updatedAt:"2026-10-08T09:00:00Z",works:[]};
describe("post data boundaries (written only)",()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.spyOn(console,"error").mockImplementation(()=>{});mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});});
 afterEach(()=>{vi.restoreAllMocks();});
 it("always requests the initial public projection without revealing",async()=>{
  mocks.rpc.mockResolvedValue({data:{...card,privateDraft:"must not escape"},error:null});
  expect(await getPost(id)).toEqual(card);
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_post",{p_id:id,p_reveal:false,p_expected_version:null});
 });
 it("rejects an accidentally exposed spoiler body instead of returning it",async()=>{
  mocks.rpc.mockResolvedValue({data:{...card,body:"private body that must never reach the page"},error:null});
  await expect(getPost(id)).rejects.toThrow();
 });
 it("rejects leaked spoiler titles in list results",async()=>{
  mocks.rpc.mockResolvedValue({data:{items:[{...card,title:"spoiler title",likeCount:0,recentLikeCount:0,recentCommenterCount:0,popularityScore:0}],hasNext:false},error:null});
  await expect(listPosts({q:"",category:null,work:null,page:1})).rejects.toThrow();
 });
 it("does not turn database errors into a successful empty list",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:"XX000",message:"private database detail"}});
  await expect(listPosts({q:"",category:null,work:null,page:1})).rejects.toThrow();
  expect(console.error).toHaveBeenCalledWith("[posts] Database request failed",{code:"XX000"});
 });
 it.each(["PGRST202","PGRST205","42883","42P01"])("classifies unavailable schema %s without logging a handled error",async(code)=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code,message:"private database detail",details:"secret SQL",hint:"private schema"}});
  await expect(listPosts({q:"",category:null,work:null,page:1})).rejects.toMatchObject({code:"CONFIG_REQUIRED",message:"커뮤니티 기능을 준비하고 있어요. 잠시 후 다시 방문해 주세요."});
  expect(console.error).not.toHaveBeenCalled();
 });
 it("uses a current authenticated owner query for drafts",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});
  expect(await getMyPostEditor(id)).toBeNull();
  expect(mocks.account).toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_my_post_editor",{p_id:id});
 });
});
