import { describe,expect,it } from "vitest";
import { communityUrl,draftPayloadSchema,filtersSchema,postCardSchema,publishPayloadSchema } from "@/lib/posts/model";
import { feedItemSchema } from "@/lib/social/feed-model";
const id="35000000-0000-4000-8000-000000000001";
const draft={title:"게시할 제목입니다",body:"공개할 본문을 충분히 길게 작성하는 테스트입니다.",category:"general",isSpoiler:false,workIds:[]};
const card={id,authorId:id,username:"post_reader",name:"독자",avatar:null,title:draft.title,excerpt:draft.body,category:"general",isSpoiler:false,version:1,publishedAt:"2026-10-08T09:00:00Z",updatedAt:"2026-10-08T09:00:00Z",works:[]};
describe("community input and spoiler DTO boundaries (written only)",()=>{
 it("keeps incomplete drafts private and enforces publishing length after Unicode trim",()=>{
  expect(draftPayloadSchema.safeParse({...draft,title:"",body:""}).success).toBe(true);
  expect(publishPayloadSchema.safeParse({...draft,title:"\u3000".repeat(5),body:"\n".repeat(30)}).success).toBe(false);
  expect(publishPayloadSchema.safeParse(draft).success).toBe(true);
  expect(draftPayloadSchema.safeParse({...draft,title:"😀".repeat(100)}).success).toBe(true);
  expect(draftPayloadSchema.safeParse({...draft,title:"😀".repeat(101)}).success).toBe(false);
 });
 it("rejects duplicate/excess work IDs and injected owner or publication state",()=>{
  for(const v of [{...draft,workIds:[id,id]},{...draft,workIds:Array(6).fill(id)},{...draft,userId:id},{...draft,publicationStatus:"published"},{...draft,category:"admin"}])expect(draftPayloadSchema.safeParse(v).success).toBe(false);
 });
 it("strips unexpected private properties and rejects spoiler titles/excerpts in cards and feed",()=>{
  expect(postCardSchema.parse({...card,body:"private",draft:{title:"private"}})).toEqual(card);
  expect(postCardSchema.safeParse({...card,isSpoiler:true}).success).toBe(false);
  expect(postCardSchema.safeParse({...card,isSpoiler:true,title:null,excerpt:null}).success).toBe(true);
  const feed={kind:"post",id,eventId:id,createdAt:"2026-10-08T09:00:00.000001Z",author:{id,username:"reader",name:"독자",avatarPath:null},isSpoiler:true,title:null,excerpt:null};
  expect(feedItemSchema.safeParse(feed).success).toBe(true);
  expect(feedItemSchema.safeParse({...feed,excerpt:"spoiler"}).success).toBe(false);
  expect(feedItemSchema.safeParse({...feed,title:"spoiler"}).success).toBe(false);
 });
 it("preserves filters in pagination and bounds requests",()=>{
  const filters={q:"감상 & 추천",category:"general" as const,work:id,page:2};
  const url=new URL(communityUrl(filters),"https://example.test");expect(url.searchParams.get("q")).toBe(filters.q);expect(url.searchParams.get("work")).toBe(id);expect(url.searchParams.get("page")).toBe("2");
  expect(filtersSchema.safeParse({...filters,page:1001}).success).toBe(false);expect(filtersSchema.safeParse({...filters,q:["secret"]}).success).toBe(false);
 });
});
