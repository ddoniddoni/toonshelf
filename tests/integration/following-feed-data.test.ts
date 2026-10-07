// @vitest-environment node
// Mocked member/DAL boundary, not a live Auth/RLS or migration test. Written only.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
import { AuthFailure } from "@/lib/auth/errors";
import { getFollowingFeed } from "@/lib/social/feed-data";
import { readFeedCursor,writeFeedCursor } from "@/lib/social/feed-cursor";
const viewer="33000000-0000-4000-8000-000000000001",author="33000000-0000-4000-8000-000000000002";
const createdAt="2026-10-07T10:00:00.123456Z";
const items=Array.from({length:20},(_,i)=>({kind:"tier",eventId:`93000000-0000-4000-8000-${String(20-i).padStart(12,"0")}`,
 id:`73000000-0000-4000-8000-${String(20-i).padStart(12,"0")}`,createdAt,author:{id:author,username:"feed_author",name:"독자",avatarPath:null},isSpoiler:false,title:"공개 티어"}));
describe("following feed DAL (written only)",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc},user:{id:viewer}});mocks.rpc.mockResolvedValue({data:{hasFollowing:false,items:[],next:null},error:null});});
 it("requires the current active member and accepts no client actor or reveal override",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("AUTH_REQUIRED","로그인이 필요해요."));
  await expect(getFollowingFeed({})).rejects.toMatchObject({code:"AUTH_REQUIRED"});expect(mocks.rpc).not.toHaveBeenCalled();
  await expect(getFollowingFeed({actor:author})).rejects.toThrow();await expect(getFollowingFeed({reveal:true})).rejects.toThrow();
 });
 it("uses the user's RPC client, projects public data and issues a matching next cursor",async()=>{
  const last=items.at(-1)!,next={id:last.eventId,createdAt};
  mocks.rpc.mockResolvedValue({data:{hasFollowing:true,items:items.map(i=>({...i,privateMemo:"secret",author:{...i.author,email:"private"}})),next},error:null});
  const result=await getFollowingFeed({});expect(result.items).toEqual(items);
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_following_feed",{p_cursor:null});
  expect(readFeedCursor(result.nextCursor!,viewer)).toEqual(next);expect(JSON.stringify(result)).not.toMatch(/private|secret/);
 });
 it("passes an exact sort boundary and rejects another account's cursor before RPC",async()=>{
  const position={id:items[0].eventId,createdAt},cursor=writeFeedCursor(position,viewer)!;
  expect(await getFollowingFeed({cursor})).toEqual({hasFollowing:false,items:[],nextCursor:null});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_following_feed",{p_cursor:position});
  mocks.rpc.mockClear();await expect(getFollowingFeed({cursor:writeFeedCursor(position,author)})).rejects.toMatchObject({code:"VALIDATION_ERROR"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("never converts missing or unsafe replies into an empty feed",async()=>{
  for (const data of [null,{items:[]},{hasFollowing:true,items:[{...items[0],isSpoiler:true}],next:null}]) {
   mocks.rpc.mockResolvedValue({data,error:null});await expect(getFollowingFeed({})).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  }
  mocks.rpc.mockResolvedValue({data:{hasFollowing:true,items:[items[0]],next:null},error:null});
  await expect(getFollowingFeed({cursor:writeFeedCursor({id:items[0].eventId,createdAt},viewer)})).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  mocks.rpc.mockResolvedValue({data:null,error:{message:"private SQL body"}});
  await expect(getFollowingFeed({})).rejects.toMatchObject({code:"INTERNAL_ERROR"});
 });
});
