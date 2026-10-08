// Written only: no execution, database permissions or performance proof.
import { describe,expect,it } from "vitest";
import { communityUrl,filtersSchema,postListingCardSchema } from "@/lib/posts/model";
import { notificationLink,notificationSchema } from "@/lib/notifications/model";
const id="35000000-0000-4000-8000-000000000001",other="35000000-0000-4000-8000-000000000002";
const card={id,authorId:id,username:"reader",name:"독자",avatar:null,title:null,excerpt:null,category:"general",isSpoiler:true,version:1,publishedAt:"2026-10-08T09:00:00Z",updatedAt:"2026-10-08T09:00:00Z",works:[],likeCount:5,recentLikeCount:3,recentCommenterCount:2,popularityScore:7};
describe("community discovery and notification contracts",()=>{
 it("preserves popular sort and filters across pagination",()=>{
  const input=filtersSchema.parse({q:"이야기",category:"general",work:id,page:2,sort:"popular"});
  const query=new URL(communityUrl(input),"https://example.test").searchParams;
  expect(query.get("sort")).toBe("popular");expect(query.get("q")).toBe("이야기");expect(query.get("page")).toBe("2");expect(query.get("work")).toBe(id);
  expect(filtersSchema.safeParse({...input,sort:["latest","popular"]}).success).toBe(false);
 });
 it("requires real bounded metrics and keeps spoiler listing data hidden",()=>{
  expect(postListingCardSchema.parse(card)).toEqual(card);
  for(const value of [{...card,likeCount:undefined},{...card,recentLikeCount:6},{...card,popularityScore:99},{...card,title:"비밀 제목입니다"},{...card,excerpt:"숨긴 원문"}])expect(postListingCardSchema.safeParse(value).success).toBe(false);
 });
 it("routes post notifications to exact public posts/comments without text payloads",()=>{
  const base={id,createdAt:"2026-10-08T10:00:00.000001Z",readAt:null,actor:{id:other,username:"reader",name:"독자"},postId:id,title:"private-title",body:"private-body"};
  expect(notificationLink(notificationSchema.parse({...base,kind:"post_like"}))).toBe(`/posts/${id}`);
  for(const kind of ["post_comment","post_reply"]){const item=notificationSchema.parse({...base,kind,commentId:other});expect(notificationLink(item)).toBe(`/posts/${id}/comments/${other}`);expect(JSON.stringify(item)).not.toContain("private-");}
  const hidden=notificationSchema.parse({...base,kind:"unavailable",commentId:other});expect(hidden).toEqual({id,createdAt:base.createdAt,readAt:null,kind:"unavailable"});expect(notificationLink(hidden)).toBeNull();
 });
});
