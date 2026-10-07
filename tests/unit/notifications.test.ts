import { describe,expect,it } from "vitest";
import { notificationSchema,notificationQuerySchema,notificationsPageSchema,notificationLink,readAllNotificationsSchema } from "@/lib/notifications/model";
const id="35000000-0000-4000-8000-000000000001",time="2026-10-08T01:00:00.123456Z";
const common={id,createdAt:time,readAt:null};
describe("notification contracts (written only)",()=>{
 it("strips source identity and content from unavailable projections",()=>{
  const item=notificationSchema.parse({...common,kind:"unavailable",actor:{id,name:"hidden"},tierId:id,body:"secret",title:"spoiler"});
  expect(item).toEqual({...common,kind:"unavailable"});expect(notificationLink(item)).toBeNull();
 });
 it("links exact comments and old submissions without carrying their text",()=>{
  const item=notificationSchema.parse({...common,kind:"tier_reply",actor:{id,username:"reader",name:"독자",email:"secret"},tierId:id,commentId:id,body:"spoiler"});
  expect(notificationLink(item)).toBe(`/tiers/${id}/comments/${id}`);expect(JSON.stringify(item)).not.toMatch(/secret|spoiler/);
  expect(notificationLink({...common,kind:"submission_result",submissionId:id})).toBe(`/submissions/${id}`);
 });
 it("rejects injected authority, repeated filters and lossy cutoff timestamps",()=>{
  for (const value of [{recipientId:id},{filter:["all","unread"]},{filter:"all",reveal:true},{cursor:"not a cursor"}]) expect(notificationQuerySchema.safeParse(value).success).toBe(false);
  expect(readAllNotificationsSchema.safeParse({through:time,recipientId:id}).success).toBe(false);
  expect(readAllNotificationsSchema.safeParse({through:"2026-10-08T01:00:00.123Z"}).success).toBe(false);
 });
 it("rejects duplicate, out-of-order, inconsistent counts and invented next cursors",()=>{
  const item={...common,kind:"unavailable"},page={items:[item],unreadCount:1,readThrough:time,next:null};
  expect(notificationsPageSchema.safeParse(page).success).toBe(true);
  for (const value of [{...page,unreadCount:0},{...page,items:[item,item]},{...page,next:{id,createdAt:time}},
   {...page,items:[item,{...item,id:"35000000-0000-4000-8000-000000000002"}],unreadCount:2}]) expect(notificationsPageSchema.safeParse(value).success).toBe(false);
 });
});
