// @vitest-environment node
// Mocked boundaries only; not evidence of live Auth, RLS or migration execution.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { AuthFailure } from "@/lib/auth/errors";
import { getNotifications,getUnreadNotificationCount } from "@/lib/notifications/data";
import { markNotificationRead,markAllNotificationsRead } from "@/lib/notifications/actions";
import { readNotificationCursor,writeNotificationCursor } from "@/lib/notifications/cursor";
const viewer="35000000-0000-4000-8000-000000000001",other="35000000-0000-4000-8000-000000000002";
const time="2026-10-08T01:00:00.123456Z",id="95000000-0000-4000-8000-000000000001";
const empty={items:[],unreadCount:0,readThrough:time,next:null};
describe("notification DAL and actions (written only)",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc},user:{id:viewer}});mocks.rpc.mockResolvedValue({data:empty,error:null});});
 it("requires current membership for both reads and writes",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("AUTH_REQUIRED","로그인이 필요해요."));
  await expect(getNotifications({})).rejects.toMatchObject({code:"AUTH_REQUIRED"});
  expect(await markNotificationRead({id})).toMatchObject({ok:false,error:{code:"AUTH_REQUIRED"}});
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("binds pagination to viewer and filter without treating the cursor as authority",async()=>{
  const position={id,createdAt:time},cursor=writeNotificationCursor(position,viewer,"unread")!;
  expect(readNotificationCursor(cursor,viewer,"unread")).toEqual(position);
  await getNotifications({filter:"unread",cursor});expect(mocks.rpc).toHaveBeenCalledWith("toon_list_notifications",{p_unread:true,p_cursor:position});
  mocks.rpc.mockClear();
  for (const input of [{filter:"all",cursor},{filter:"unread",cursor:writeNotificationCursor(position,other,"unread")},{recipientId:other}]) await expect(getNotifications(input)).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("rejects unread-page read rows and out-of-bound or malformed replies",async()=>{
  for (const data of [null,{...empty,items:[{id,kind:"unavailable",createdAt:time,readAt:time}]},{...empty,unreadCount:-1}]) {
   mocks.rpc.mockResolvedValue({data,error:null});await expect(getNotifications({filter:"unread"})).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  }
  mocks.rpc.mockResolvedValue({data:{...empty,unreadCount:1,items:[{id,kind:"unavailable",createdAt:time,readAt:null}]},error:null});
  await expect(getNotifications({cursor:writeNotificationCursor({id,createdAt:time},viewer,"all")})).rejects.toMatchObject({code:"INTERNAL_ERROR"});
  mocks.rpc.mockResolvedValue({data:null,error:null});await expect(getUnreadNotificationCount()).rejects.toMatchObject({code:"INTERNAL_ERROR"});
 });
 it("accepts only the matching read acknowledgement and invalidates inbox/header",async()=>{
  mocks.rpc.mockResolvedValue({data:{id,readAt:time},error:null});
  expect(await markNotificationRead({id})).toEqual({ok:true,receipt:{id,readAt:time}});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_mark_notification_read",{p_id:id});
  expect(mocks.revalidate.mock.calls).toEqual([["/me/notifications"],["/","layout"]]);
  mocks.revalidate.mockClear();mocks.rpc.mockResolvedValue({data:{id:other,readAt:time},error:null});
  expect(await markNotificationRead({id})).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("passes the original cutoff, rejects actor injection and hides database errors",async()=>{
  mocks.rpc.mockResolvedValue({data:{through:time,updated:0},error:null});
  expect(await markAllNotificationsRead({through:time})).toEqual({ok:true,receipt:{through:time,updated:0}});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_mark_all_notifications_read",{p_through:time});
  mocks.rpc.mockClear();expect(await markAllNotificationsRead({through:time,recipient:other})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({data:null,error:{message:"NOT_FOUND"}});expect(await markNotificationRead({id})).toMatchObject({ok:false,error:{code:"NOT_FOUND"}});
  mocks.rpc.mockResolvedValue({data:null,error:{message:"private sql secret"}});expect(JSON.stringify(await markNotificationRead({id}))).not.toMatch(/private sql secret/);
 });
});
