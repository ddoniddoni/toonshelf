// Written only. No actual browser, session or user flow executed.
import { cleanup,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({one:vi.fn(),all:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
vi.mock("@/lib/notifications/actions",()=>({markNotificationRead:mocks.one,markAllNotificationsRead:mocks.all}));
import { NotificationList } from "@/components/notifications/inbox";
import { NotificationReadControl } from "@/components/notifications/read-controls";
const id="95000000-0000-4000-8000-000000000001",time="2026-10-08T01:00:00.123456Z";
afterEach(cleanup);beforeEach(()=>vi.resetAllMocks());
describe("notification UI (written only)",()=>{
 it("shows unavailable notifications without actor or destination links",()=>{
  render(<NotificationList inbox={{items:[{id,kind:"unavailable",createdAt:time,readAt:null}],unreadCount:1,readThrough:time,nextCursor:null}} filter="all" hasCursor={false}/>);
  expect(screen.getByText("더 이상 볼 수 없는 콘텐츠예요.")).toBeInTheDocument();expect(screen.queryByRole("link")).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"읽음으로 표시"})).toBeInTheDocument();
 });
 it("does not report success or refresh after an uncertain write",async()=>{
  mocks.one.mockRejectedValue(new Error("network"));render(<NotificationReadControl target={{kind:"one",id}}/>);
  fireEvent.click(screen.getByRole("button",{name:"읽음으로 표시"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("처리 결과를 확인하지 못했어요");expect(mocks.refresh).not.toHaveBeenCalled();
 });
 it("marks all using the loaded boundary and refreshes after acknowledgement",async()=>{
  mocks.all.mockResolvedValue({ok:true,receipt:{through:time,updated:1}});render(<NotificationReadControl target={{kind:"all",through:time}}/>);
  fireEvent.click(screen.getByRole("button",{name:"모두 읽음"}));await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledTimes(1));
  expect(mocks.all).toHaveBeenCalledWith({through:time});expect(screen.getByRole("status")).toHaveTextContent("페이지를 불러온 시점까지");
 });
});
