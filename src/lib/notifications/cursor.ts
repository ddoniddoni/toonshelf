import "server-only";
import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { AuthFailure } from "@/lib/auth/errors";
import { notificationFilterSchema,notificationPositionSchema,notificationQuerySchema,type NotificationFilter,type NotificationPosition } from "./model";
const envelope=z.strictObject({v:z.literal(1),viewerId:uuidSchema,filter:notificationFilterSchema,position:notificationPositionSchema});
export function readNotificationCursor(value:string|undefined,viewerId:string,filter:NotificationFilter):NotificationPosition|null {
 if (value===undefined) return null;
 try {
  notificationQuerySchema.parse({cursor:value,filter});
  const result=envelope.parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")));
  if (result.viewerId!==viewerId || result.filter!==filter) throw new Error();
  return result.position;
 } catch {throw new AuthFailure("VALIDATION_ERROR","최신 알림부터 다시 확인해 주세요.");}
}
export function writeNotificationCursor(position:NotificationPosition|null,viewerId:string,filter:NotificationFilter):string|null {
 return position ? Buffer.from(JSON.stringify(envelope.parse({v:1,viewerId,filter,position}))).toString("base64url") : null;
}
