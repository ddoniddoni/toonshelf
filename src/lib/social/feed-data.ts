import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { AuthFailure,databaseError } from "@/lib/auth/errors";
import { feedPageSchema,feedQuerySchema,type FollowingFeed } from "./feed-model";
import { readFeedCursor,writeFeedCursor } from "./feed-cursor";

export async function getFollowingFeed(input:unknown):Promise<FollowingFeed> {
 const value=feedQuerySchema.parse(input);
 const {client,user}=await requireAccount();
 const position=readFeedCursor(value.cursor,user.id);
 const {data,error}=await client.rpc("toon_get_following_feed",{p_cursor:position});
 databaseError(error);
 const parsed=feedPageSchema.safeParse(data);
 if (!parsed.success) throw new AuthFailure("INTERNAL_ERROR","피드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
 if (position && parsed.data.items.some(item=>item.createdAt > position.createdAt || (item.createdAt === position.createdAt && item.eventId >= position.id)))
  throw new AuthFailure("INTERNAL_ERROR","이전 게시물을 불러오지 못했어요. 최신 게시물부터 다시 확인해 주세요.");
 return {hasFollowing:parsed.data.hasFollowing,items:parsed.data.items,nextCursor:writeFeedCursor(parsed.data.next,user.id)};
}
