import "server-only";
import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { AuthFailure } from "@/lib/auth/errors";
import { feedPositionSchema,feedQuerySchema,type FeedPosition } from "./feed-model";

const cursorSchema = z.strictObject({v:z.literal(1),viewerId:uuidSchema,position:feedPositionSchema});
export function readFeedCursor(value:string|undefined,viewerId:string):FeedPosition|null {
 if (value === undefined) return null;
 try {
  feedQuerySchema.parse({cursor:value});
  const cursor=cursorSchema.parse(JSON.parse(Buffer.from(value,"base64url").toString("utf8")));
  if (cursor.viewerId !== viewerId) throw new Error();
  return cursor.position;
 } catch {throw new AuthFailure("VALIDATION_ERROR","페이지 주소가 바뀌었어요. 최신 게시물부터 다시 확인해 주세요.");}
}
export function writeFeedCursor(position:FeedPosition|null,viewerId:string):string|null {
 return position ? Buffer.from(JSON.stringify(cursorSchema.parse({v:1,viewerId,position}))).toString("base64url") : null;
}
