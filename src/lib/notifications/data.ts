import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { AuthFailure,databaseError } from "@/lib/auth/errors";
import { notificationCountSchema,notificationQuerySchema,notificationsPageSchema,type NotificationInbox } from "./model";
import { readNotificationCursor,writeNotificationCursor } from "./cursor";
export async function getNotifications(input:unknown):Promise<NotificationInbox> {
 const query=notificationQuerySchema.parse(input),{client,user}=await requireAccount();
 const cursor=readNotificationCursor(query.cursor,user.id,query.filter);
 const {data,error}=await client.rpc("toon_list_notifications",{p_unread:query.filter==="unread",p_cursor:cursor});
 databaseError(error);const result=notificationsPageSchema.safeParse(data);
 if (!result.success || result.data.items.some(item=>(query.filter==="unread" && item.readAt!==null)
  || (cursor && (item.createdAt>cursor.createdAt || (item.createdAt===cursor.createdAt && item.id>=cursor.id)))))
  throw new AuthFailure("INTERNAL_ERROR","알림을 불러오지 못했어요. 최신 알림부터 다시 확인해 주세요.");
 const {next,...page}=result.data;
 return {...page,nextCursor:writeNotificationCursor(next,user.id,query.filter)};
}
export async function getUnreadNotificationCount():Promise<number> {
 const {client}=await requireAccount();const {data,error}=await client.rpc("toon_notification_unread_count");
 databaseError(error);const result=notificationCountSchema.safeParse(data);
 if (!result.success) throw new AuthFailure("INTERNAL_ERROR","읽지 않은 알림 수를 확인하지 못했어요.");
 return result.data;
}
