// @vitest-environment node
// Written only. No live database or user-flow verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/auth/session",()=>({requireAccount:vi.fn()}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:()=>({supabase:{}})}));
import { listReviews } from "@/lib/reviews/data";
import { withReviewAvailability } from "@/lib/reviews/availability";
import { getReviewLikeState } from "@/lib/reviews/like-data";
import { listReviewComments } from "@/lib/review-comments/data";
vi.mock("@/lib/reviews/moderation",()=>({requireModerator:vi.fn()}));
const id="36000000-0000-4000-8000-000000000001";
const card={id,workId:id,workTitle:"작품",workSlug:"work",authorId:id,username:"reader",name:"독자",avatar:null,isSpoiler:true,episode:null,excerpt:null,version:1,publishedAt:"2026-10-08T00:00:00Z",updatedAt:"2026-10-08T00:00:00Z",ratingSteps:null,canonicalTier:null};
const engagement={likeCount:4,recentLikeCount:2,recentCommenterCount:3,popularityScore:8};
describe("review discovery rollout",()=>{
 beforeEach(()=>{vi.resetAllMocks();});
 it("preserves installed latest reads without inventing engagement counts",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"PGRST202"}}).mockResolvedValueOnce({data:{items:[card],total:1,hasNext:false},error:null});
  const page=await listReviews(id,null,2,"popular");
  expect(page).toMatchObject({sort:"latest",engagementAvailable:false,items:[card]});
  expect(page?.items[0].engagement).toBeUndefined();
  expect(mocks.rpc).toHaveBeenLastCalledWith("toon_list_reviews",{p_work:id,p_username:null,p_page:2});
 });
 it("passes explicit sort and accepts only coherent real metrics",async()=>{
  mocks.rpc.mockResolvedValue({data:{items:[{...card,engagement}],total:1,hasNext:false},error:null});
  expect(await listReviews(null,"reader",1,"likes")).toMatchObject({sort:"likes",engagementAvailable:true});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_search_reviews",{p_work:null,p_username:"reader",p_page:1,p_sort:"likes"});
  mocks.rpc.mockResolvedValue({data:{items:[card],total:1,hasNext:false},error:null});
  await expect(listReviews(id,null)).rejects.toThrow();
  mocks.rpc.mockResolvedValue({data:{items:[{...card,engagement:{...engagement,popularityScore:99}}],total:1,hasNext:false},error:null});
  await expect(listReviews(id,null)).rejects.toThrow();
 });
 it("does not convert an inaccessible target or unexpected error into an empty list",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await listReviews(id,null)).toBeNull();
  mocks.rpc.mockClear();mocks.rpc.mockResolvedValue({data:null,error:{code:"XX000",message:"private SQL"}});
  await expect(listReviews(id,null)).rejects.toMatchObject({code:"INTERNAL_ERROR"});expect(mocks.rpc).toHaveBeenCalledTimes(1);
 });
 it("handles missing likes/comments silently but propagates unexpected read failures",async()=>{
  const log=vi.spyOn(console,"error").mockImplementation(()=>{});
  try {
   mocks.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});
   expect(await withReviewAvailability(()=>getReviewLikeState(id))).toEqual({available:false});
   expect(await withReviewAvailability(()=>listReviewComments({reviewId:id,reviewVersion:1,parentId:null,page:1}))).toEqual({available:false});
   expect(log).not.toHaveBeenCalled();
   mocks.rpc.mockResolvedValue({data:null,error:{code:"XX000"}});
   await expect(withReviewAvailability(()=>getReviewLikeState(id))).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  } finally {log.mockRestore();}
 });
 it("validates exactly one scope, page and sort before making a request",async()=>{
  for(const args of [[null,null,1,"latest"],[id,"reader",1,"latest"],[id,null,1001,"latest"],[id,null,1,"bad"]] as const) {
   await expect(listReviews(args[0],args[1],args[2],args[3] as "latest")).rejects.toThrow();
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
