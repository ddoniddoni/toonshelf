import { z } from "zod";
import { slugSchema,uuidSchema } from "@/lib/catalogue/model";
import { followProfileSchema } from "./model";

// Keep Postgres microseconds intact: Date.toISOString() would lose cursor ties.
const timeSchema = z.iso.datetime({precision:6});
const text = (min:number,max:number) => z.string().refine(s=>[...s].length >= min && [...s].length <= max);
export const feedQuerySchema = z.strictObject({cursor:z.string().min(1).max(1024).regex(/^[A-Za-z0-9_-]+$/).optional()});
export const feedPositionSchema = z.strictObject({id:uuidSchema,createdAt:timeSchema});
const common = {eventId:uuidSchema,createdAt:timeSchema,author:followProfileSchema,id:uuidSchema,isSpoiler:z.boolean()};
export const feedItemSchema = z.discriminatedUnion("kind",[
 z.object({...common,kind:z.literal("review"),work:z.object({id:uuidSchema,title:text(1,200),slug:slugSchema}),excerpt:text(0,240).nullable()}),
 z.object({...common,kind:z.literal("tier"),title:text(1,80).nullable()}),
 z.object({...common,kind:z.literal("post"),title:text(5,100).nullable(),excerpt:text(0,240).nullable()})
]).refine(item=>item.kind === "review" ? item.isSpoiler === (item.excerpt === null) : item.kind === "post" ? item.isSpoiler === (item.title === null) && item.isSpoiler === (item.excerpt === null) : item.isSpoiler === (item.title === null),
 {message:"스포일러 표시와 공개 내용이 일치하지 않아요."});
export const feedPageSchema = z.object({hasFollowing:z.boolean(),items:z.array(feedItemSchema).max(20),next:feedPositionSchema.nullable()})
 .superRefine((page,ctx)=>{
  if (!page.hasFollowing && (page.items.length || page.next)) ctx.addIssue({code:"custom",message:"팔로우 상태와 목록이 일치하지 않아요."});
  if (new Set(page.items.map(item=>item.eventId)).size !== page.items.length) ctx.addIssue({code:"custom",message:"피드 항목이 중복됐어요."});
  for (let i=1;i<page.items.length;i++) {
   const previous=page.items[i-1],current=page.items[i];
   if (previous.createdAt < current.createdAt || (previous.createdAt === current.createdAt && previous.eventId <= current.eventId))
    ctx.addIssue({code:"custom",message:"피드 순서가 일치하지 않아요."});
  }
  const last=page.items.at(-1);
  if (page.next && (page.items.length !== 20 || !last || last.eventId !== page.next.id || last.createdAt !== page.next.createdAt))
   ctx.addIssue({code:"custom",message:"다음 페이지 위치가 일치하지 않아요."});
 });
export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedPosition = z.infer<typeof feedPositionSchema>;
export type FollowingFeed = {hasFollowing:boolean;items:FeedItem[];nextCursor:string|null};
export function feedUrl(cursor:string|null = null) {
 return cursor ? `/me/feed?${new URLSearchParams({cursor})}` : "/me/feed";
}
