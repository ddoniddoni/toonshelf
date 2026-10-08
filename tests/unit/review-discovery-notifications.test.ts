// Written only; no database or browser verification.
import { describe,expect,it } from "vitest";
import { reviewEngagementSchema,reviewSortSchema } from "@/lib/reviews/model";
import { notificationSchema,notificationLink } from "@/lib/notifications/model";
import { reviewListUrl } from "@/components/reviews/sort-control";
const id="36000000-0000-4000-8000-000000000001",other="36000000-0000-4000-8000-000000000002";
describe("review discovery and notification contract",()=>{
 it("preserves sort and page in review navigation",()=>{
  expect(reviewListUrl("/works/story/reviews","popular",2)).toBe("/works/story/reviews?sort=popular&page=2");
  expect(reviewSortSchema.safeParse(["latest","likes"]).success).toBe(false);
 });
 it("rejects missing, negative or inconsistent engagement counts",()=>{
  const counts={likeCount:3,recentLikeCount:2,recentCommenterCount:2,popularityScore:6};
  expect(reviewEngagementSchema.parse(counts)).toEqual(counts);
  for(const value of [{...counts,likeCount:undefined},{...counts,recentLikeCount:4},{...counts,popularityScore:7},{...counts,recentCommenterCount:-1}])expect(reviewEngagementSchema.safeParse(value).success).toBe(false);
 });
 it("links exact review comments and strips text or unavailable target identities",()=>{
  const base={id,createdAt:"2026-10-08T10:00:00.000001Z",readAt:null,actor:{id:other,username:"reader",name:"독자"},reviewId:id,body:"private-body"};
  expect(notificationLink(notificationSchema.parse({...base,kind:"review_like"}))).toBe(`/reviews/${id}`);
  for(const kind of ["review_comment","review_reply"]) {
   const item=notificationSchema.parse({...base,kind,commentId:other});expect(notificationLink(item)).toBe(`/reviews/${id}/comments/${other}`);expect(JSON.stringify(item)).not.toContain("private-body");
  }
  const unavailable=notificationSchema.parse({...base,kind:"unavailable",commentId:other});
  expect(unavailable).toEqual({id,createdAt:base.createdAt,readAt:null,kind:"unavailable"});expect(notificationLink(unavailable)).toBeNull();
 });
});
