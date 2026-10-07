import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { usernameSchema } from "@/lib/auth/validation";

// Preserve Postgres microseconds in pagination and mark-all boundaries.
export const notificationTimeSchema=z.iso.datetime({precision:6});
export const notificationCountSchema=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const notificationFilterSchema=z.enum(["all","unread"]);
export const notificationQuerySchema=z.strictObject({filter:notificationFilterSchema.default("all"),cursor:z.string().min(1).max(1024).regex(/^[A-Za-z0-9_-]+$/).optional()});
export const notificationPositionSchema=z.strictObject({id:uuidSchema,createdAt:notificationTimeSchema});
const actorSchema=z.object({id:uuidSchema,username:usernameSchema,name:z.string().refine(s=>[...s].length>=2 && [...s].length<=30)});
const common={id:uuidSchema,createdAt:notificationTimeSchema,readAt:notificationTimeSchema.nullable()};
export const notificationSchema=z.discriminatedUnion("kind",[
 z.object({...common,kind:z.literal("unavailable")}),
 z.object({...common,kind:z.literal("follow"),actor:actorSchema}),
 z.object({...common,kind:z.literal("tier_like"),actor:actorSchema,tierId:uuidSchema}),
 z.object({...common,kind:z.literal("tier_comment"),actor:actorSchema,tierId:uuidSchema,commentId:uuidSchema}),
 z.object({...common,kind:z.literal("tier_reply"),actor:actorSchema,tierId:uuidSchema,commentId:uuidSchema}),
 z.object({...common,kind:z.literal("submission_result"),submissionId:uuidSchema})
]);
export const notificationsPageSchema=z.object({items:z.array(notificationSchema).max(20),unreadCount:notificationCountSchema,readThrough:notificationTimeSchema,next:notificationPositionSchema.nullable()})
 .superRefine((page,ctx)=>{
  if (new Set(page.items.map(item=>item.id)).size!==page.items.length) ctx.addIssue({code:"custom",message:"알림이 중복됐어요."});
  for (let i=1;i<page.items.length;i++) {
   const a=page.items[i-1],b=page.items[i];
   if (a.createdAt<b.createdAt || (a.createdAt===b.createdAt && a.id<=b.id)) ctx.addIssue({code:"custom",message:"알림 순서가 일치하지 않아요."});
  }
  if (page.items.filter(item=>item.readAt===null).length>page.unreadCount) ctx.addIssue({code:"custom",message:"읽지 않은 알림 수가 일치하지 않아요."});
  const last=page.items.at(-1);
  if (page.next && (page.items.length!==20 || !last || last.id!==page.next.id || last.createdAt!==page.next.createdAt)) ctx.addIssue({code:"custom",message:"다음 알림 위치가 일치하지 않아요."});
 });
export const readNotificationSchema=z.strictObject({id:uuidSchema});
export const readAllNotificationsSchema=z.strictObject({through:notificationTimeSchema});
export const readNotificationAckSchema=z.object({id:uuidSchema,readAt:notificationTimeSchema});
export const readAllNotificationsAckSchema=z.object({through:notificationTimeSchema,updated:notificationCountSchema});
export type Notification=z.infer<typeof notificationSchema>;
export type NotificationFilter=z.infer<typeof notificationFilterSchema>;
export type NotificationPosition=z.infer<typeof notificationPositionSchema>;
export type NotificationInbox=Omit<z.infer<typeof notificationsPageSchema>,"next"> & {nextCursor:string|null};
export function notificationsUrl(filter:NotificationFilter="all",cursor:string|null=null) {
 const query=new URLSearchParams();if (filter!=="all") query.set("filter",filter);if (cursor) query.set("cursor",cursor);
 return `/me/notifications${query.size ? `?${query}` : ""}`;
}
export function notificationLink(item:Notification):string|null {
 switch(item.kind) {
  case "follow":return `/u/${item.actor.username}`;
  case "tier_like":return `/tiers/${item.tierId}`;
  case "tier_comment":case "tier_reply":return `/tiers/${item.tierId}/comments/${item.commentId}`;
  case "submission_result":return `/submissions/${item.submissionId}`;
  case "unavailable":return null;
 }
}
