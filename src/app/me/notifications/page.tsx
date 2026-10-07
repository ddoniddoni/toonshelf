import Link from "next/link";
import { z } from "zod";
import { guardPage } from "@/lib/auth/session";
import { AuthFailure } from "@/lib/auth/errors";
import type { SearchParams } from "@/lib/catalogue/model";
import { getNotifications } from "@/lib/notifications/data";
import { notificationQuerySchema,notificationsUrl,type NotificationInbox } from "@/lib/notifications/model";
import { NotificationList } from "@/components/notifications/inbox";
import { NotificationReadControl,NotificationRefresh } from "@/components/notifications/read-controls";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"내 알림",description:"나에게 도착한 알림을 확인해요.",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account=await guardPage("/me/notifications");
 if (!account) return <section className="page-container notifications-page"><h1>내 알림</h1><ConnectionNotice/></section>;
 let inbox:NotificationInbox,query:z.infer<typeof notificationQuerySchema>;
 try {query=notificationQuerySchema.parse(await searchParams);inbox=await getNotifications(query);} catch(error) {
  if (!(error instanceof z.ZodError) && !(error instanceof AuthFailure && error.code==="VALIDATION_ERROR")) throw error;
  return <section className="page-container notifications-page"><h1>내 알림</h1><p role="alert">페이지 주소를 확인해 주세요.</p><Link className="text-link" href="/me/notifications" prefetch={false}>최신 알림으로</Link></section>;
 }
 return <section className="page-container notifications-page"><div className="hub-section-heading"><div><p className="eyebrow">NOTIFICATIONS</p><h1>내 알림</h1><p>내가 나눈 이야기와 새로운 연결.</p></div><Link className="text-link" href="/settings/notifications" prefetch={false}>알림 설정</Link></div>
  <div className="notification-toolbar"><nav className="notification-filters" aria-label="알림 필터"><Link href={notificationsUrl()} aria-current={query.filter==="all" ? "page" : undefined} prefetch={false}>전체</Link><Link href={notificationsUrl("unread")} aria-current={query.filter==="unread" ? "page" : undefined} prefetch={false}>읽지 않음 {inbox.unreadCount}개</Link></nav><NotificationRefresh/>
   {inbox.unreadCount>0 ? <NotificationReadControl key={inbox.readThrough} target={{kind:"all",through:inbox.readThrough}}/> : null}
  </div><p className="field-hint">모두 읽음은 이 페이지를 불러온 시점까지 적용해요. 새 알림은 새로고침하면 표시돼요. 시간은 한국 기준이에요.</p>
  <NotificationList inbox={inbox} filter={query.filter} hasCursor={query.cursor!==undefined}/>
 </section>;
}
