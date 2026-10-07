// @vitest-environment node
// Written only; no execution requested.
import { describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { feedItemSchema,feedPageSchema,feedQuerySchema } from "@/lib/social/feed-model";
import { readFeedCursor,writeFeedCursor } from "@/lib/social/feed-cursor";

const viewer="33000000-0000-4000-8000-000000000001",other="33000000-0000-4000-8000-000000000002";
const time="2026-10-07T10:00:00.123456Z";
const item={kind:"tier" as const,eventId:"93000000-0000-4000-8000-000000000020",id:"73000000-0000-4000-8000-000000000001",createdAt:time,
 author:{id:other,username:"feed_reader",name:"독자",avatarPath:null},isSpoiler:false,title:"내 티어표"};
describe("following feed input and output boundary (written only)",()=>{
 it("rejects injected ownership, reveal flags and duplicate query parameters",()=>{
  for (const value of [{actor:other},{reveal:"true"},{cursor:["a","b"]},{cursor:""},{cursor:"a".repeat(1025)}]) expect(feedQuerySchema.safeParse(value).success).toBe(false);
 });
 it("round-trips exact microseconds and binds cursor envelopes to the reader",()=>{
  const position={id:item.eventId,createdAt:time},cursor=writeFeedCursor(position,viewer)!;
  expect(readFeedCursor(cursor,viewer)).toEqual(position);
  expect(()=>readFeedCursor(cursor,other)).toThrow();
  for (const value of ["not_json",Buffer.from(JSON.stringify({v:2,viewerId:viewer,position})).toString("base64url"),
   Buffer.from(JSON.stringify({v:1,viewerId:viewer,position:{...position,createdAt:"2026-10-07T10:00:00.123Z"}})).toString("base64url")]) expect(()=>readFeedCursor(value,viewer)).toThrow();
  expect(readFeedCursor(undefined,viewer)).toBeNull();expect(writeFeedCursor(null,viewer)).toBeNull();
 });
 it("removes private fields and requires spoiler content to be absent",()=>{
  const parsed=feedItemSchema.parse({...item,body:"private draft",token:"secret",author:{...item.author,email:"hidden@example.test"}});
  expect(parsed).toEqual(item);
  expect(feedItemSchema.safeParse({...item,isSpoiler:true}).success).toBe(false);
  expect(feedItemSchema.safeParse({...item,isSpoiler:true,title:null}).success).toBe(true);
  const review={...item,kind:"review",work:{id:item.id,slug:"test-work",title:"작품"},isSpoiler:true,excerpt:null};
  expect(feedItemSchema.safeParse(review).success).toBe(true);
  expect(feedItemSchema.safeParse({...review,excerpt:"spoiler leak"}).success).toBe(false);
  expect(feedItemSchema.safeParse({...review,work:{...review.work,slug:"../private"}}).success).toBe(false);
 });
 it("rejects fabricated empty states, repeated events, wrong ordering and missing cursor fields",()=>{
  expect(feedPageSchema.safeParse({hasFollowing:false,items:[item],next:null}).success).toBe(false);
  expect(feedPageSchema.safeParse({hasFollowing:true,items:[item,item],next:null}).success).toBe(false);
  expect(feedPageSchema.safeParse({hasFollowing:true,items:[item,{...item,eventId:"93000000-0000-4000-8000-000000000021"}],next:null}).success).toBe(false);
  expect(feedPageSchema.safeParse({hasFollowing:true,items:[],next:{id:item.eventId,createdAt:time}}).success).toBe(false);
  expect(feedPageSchema.safeParse({hasFollowing:true,items:[]}).success).toBe(false);
  expect(feedPageSchema.parse({hasFollowing:false,items:[],next:null})).toEqual({hasFollowing:false,items:[],next:null});
 });
});
