"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { actionError,AuthFailure,databaseError } from "@/lib/auth/errors";
import { readNotificationSchema,readAllNotificationsSchema,readNotificationAckSchema,readAllNotificationsAckSchema } from "./model";
function invalidate() {revalidatePath("/me/notifications");revalidatePath("/","layout");}
export async function markNotificationRead(input:unknown) {
 try {
  const value=readNotificationSchema.parse(input),{client}=await requireAccount();
  const {data,error}=await client.rpc("toon_mark_notification_read",{p_id:value.id});
  if (error?.message==="NOT_FOUND") throw new AuthFailure("NOT_FOUND","현재 확인할 수 없는 알림이에요.");
  databaseError(error);const ack=readNotificationAckSchema.safeParse(data);
  if (!ack.success || ack.data.id!==value.id) throw new AuthFailure("INTERNAL_ERROR","읽음 처리 결과를 확인하지 못했어요. 최신 알림을 다시 확인해 주세요.");
  invalidate();return {ok:true as const,receipt:ack.data};
 } catch(error) {return actionError(error);}
}
export async function markAllNotificationsRead(input:unknown) {
 try {
  const value=readAllNotificationsSchema.parse(input),{client}=await requireAccount();
  const {data,error}=await client.rpc("toon_mark_all_notifications_read",{p_through:value.through});
  databaseError(error);const ack=readAllNotificationsAckSchema.safeParse(data);
  if (!ack.success || ack.data.through!==value.through) throw new AuthFailure("INTERNAL_ERROR","모두 읽음 처리 결과를 확인하지 못했어요. 최신 알림을 다시 확인해 주세요.");
  invalidate();return {ok:true as const,receipt:ack.data};
 } catch(error) {return actionError(error);}
}
