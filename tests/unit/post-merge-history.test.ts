// Written only; no automated checks have run.
import { describe,expect,it } from "vitest";
import { postMergeHistorySchema,postMergeHistoryUrl } from "@/lib/posts/merge-model";
const id="37000000-0000-4000-8000-000000000001",source="57000000-0000-4000-8000-000000000001",target="57000000-0000-4000-8000-000000000002";
const item={id,sourceId:source,targetId:target,sourceTitle:"이전 작품",targetTitle:"남길 작품",publishedBefore:[source,target],publishedAfter:[target],draftBefore:[source],draftAfter:[target],createdAt:"2026-10-08T00:00:00Z"};
describe("post linkage provenance contract",()=>{
 it("keeps ordered before/after IDs but excludes original body and private metadata",()=>{
  const result=postMergeHistorySchema.parse({postId:id,items:[{...item,body:"draft-secret",actorId:"private-admin"}],hasNext:false});
  expect(result.items).toEqual([item]);expect(JSON.stringify(result)).not.toMatch(/draft-secret|private-admin/);
 });
 it("rejects inconsistent or identifying cross-target history",()=>{
  for(const row of [{...item,targetId:source},{...item,publishedAfter:[source]},{...item,draftAfter:null},{...item,publishedAfter:[target,target]}]) {
   expect(postMergeHistorySchema.safeParse({postId:id,items:[row],hasNext:false}).success).toBe(false);
  }
  expect(postMergeHistorySchema.safeParse({postId:id,items:Array(21).fill(item),hasNext:true}).success).toBe(false);
 });
 it("preserves the owner route and bounds pagination",()=>{
  expect(postMergeHistoryUrl(id,2)).toBe(`/me/posts/${id}/merge-history?page=2`);
  expect(()=>postMergeHistoryUrl(id,1001)).toThrow();expect(()=>postMergeHistoryUrl("bad")).toThrow();
 });
});
