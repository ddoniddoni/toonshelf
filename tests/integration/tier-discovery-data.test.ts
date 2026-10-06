// @vitest-environment node
// Written DAL mocks only; not live DB/Auth/RLS or migration verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({env:vi.fn(),client:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:mocks.env}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/auth/session",()=>({requireAccount:vi.fn()}));
vi.mock("@/lib/reviews/moderation",()=>({requireModerator:vi.fn()}));
import { listPublicTiers } from "@/lib/tiers/publication-data";
const id="20000000-0000-4000-8000-000000000001";
const card={id,version:2,publishedVersion:1,publishedAt:"2026-10-05T00:00:00Z",authorId:id,username:"author",name:"작가",isSpoiler:false,title:"공개 표",tags:["100%_&?"],likeCount:3,recentLikeCount:1};
describe("tier discovery data",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.env.mockReturnValue({supabase:{url:"https://example.test",key:"public-test-key"}});mocks.client.mockResolvedValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({data:{items:[card],hasNext:false},error:null});});
 it("passes only validated literal filters and a bounded page to the session client RPC",async()=>{
  expect(await listPublicTiers(2,{sort:"popular",tag:"100%_&?"})).toEqual({items:[card],hasNext:false});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_search_public_tiers",{p_sort:"popular",p_tag:"100%_&?",p_page:2});
  await listPublicTiers(1);expect(mocks.rpc).toHaveBeenLastCalledWith("toon_search_public_tiers",{p_sort:"latest",p_tag:null,p_page:1});
 });
 it("rejects invalid pages and injected filters before creating a client",async()=>{
  const injected={sort:"latest" as const,tag:null,userId:id};
  await expect(listPublicTiers(0)).rejects.toThrow();await expect(listPublicTiers(1001)).rejects.toThrow();await expect(listPublicTiers(1,injected)).rejects.toThrow();
  expect(mocks.client).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("returns an unconfigured state without synthesizing operational counts",async()=>{
  mocks.env.mockReturnValue({supabase:null});expect(await listPublicTiers(1)).toBeNull();expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("strips unrelated fields and rejects missing counts or leaked spoiler metadata",async()=>{
  mocks.rpc.mockResolvedValue({data:{items:[{...card,body:{title:"private"},likers:["private-user"]}],hasNext:false},error:null});
  expect(JSON.stringify(await listPublicTiers(1))).not.toContain("private");
  mocks.rpc.mockResolvedValue({data:{items:[{...card,recentLikeCount:undefined}],hasNext:false},error:null});await expect(listPublicTiers(1)).rejects.toThrow();
  mocks.rpc.mockResolvedValue({data:{items:[{...card,isSpoiler:true}],hasNext:false},error:null});await expect(listPublicTiers(1)).rejects.toThrow();
 });
 it("exposes safe errors without raw SQL details",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{message:"private SQL secret",details:"private target"}});await expect(listPublicTiers(1)).rejects.toMatchObject({code:"INTERNAL_ERROR"});
 });
});
