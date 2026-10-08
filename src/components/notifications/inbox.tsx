import Link from "next/link";
import { Bell,Check } from "lucide-react";
import { type Notification,type NotificationFilter,type NotificationInbox,notificationLink,notificationsUrl } from "@/lib/notifications/model";
import { EmptyState } from "@/components/ui/empty-state";
import { NotificationReadControl } from "./read-controls";
function message(item:Notification) {
 switch(item.kind) {
  case "follow":return `${item.actor.name}님이 나를 팔로우했어요.`;
  case "tier_like":return `${item.actor.name}님이 내 티어리스트를 좋아해요.`;
  case "tier_comment":return `${item.actor.name}님이 내 티어리스트에 댓글을 남겼어요.`;
  case "tier_reply":return `${item.actor.name}님이 내 댓글에 답글을 남겼어요.`;
  case "post_like":return `${item.actor.name}님이 내 글을 좋아해요.`;
  case "post_comment":return `${item.actor.name}님이 내 글에 댓글을 남겼어요.`;
  case "post_reply":return `${item.actor.name}님이 내 댓글에 답글을 남겼어요.`;
  case "submission_result":return "보내 주신 작품 제보가 처리됐어요.";
  case "unavailable":return "더 이상 볼 수 없는 콘텐츠예요.";
 }
}
export function NotificationList({inbox,filter,hasCursor}:{inbox:NotificationInbox;filter:NotificationFilter;hasCursor:boolean}) {
 return <>
  {inbox.items.length ? <ol className="notification-list" aria-label="내 알림">{inbox.items.map(item=>{
   const href=notificationLink(item);
   return <li className={`notification-card${item.readAt===null ? " notification-unread" : ""}`} key={item.id}>
    <span className="notification-symbol" aria-hidden="true">{item.readAt===null ? <Bell size={20}/> : <Check size={20}/>}</span>
    <div className="notification-content"><p className="notification-message">{href ? <Link href={href} prefetch={false}>{message(item)}</Link> : message(item)}</p>
     <p className="notification-meta"><span>{item.readAt===null ? "읽지 않음" : "읽음"}</span> · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time></p>
     {item.kind==="unavailable" ? <p className="field-hint">삭제·공개 범위·계정 상태에 따라 연결이 제한될 수 있어요.</p> : null}
     {item.readAt===null ? <NotificationReadControl key={item.id} target={{kind:"one",id:item.id}}/> : null}
    </div>
   </li>;
  })}</ol> : <EmptyState title={hasCursor ? "이전 알림이 더 없어요" : filter==="unread" ? "읽지 않은 알림이 없어요" : "아직 도착한 알림이 없어요"} description="새 팔로워, 티어·커뮤니티 좋아요·댓글·답글, 작품 제보 처리 결과를 여기서 확인할 수 있어요."/>}
  <nav className="notification-pagination" aria-label="알림 페이지">{hasCursor ? <Link className="text-link" href={notificationsUrl(filter)} prefetch={false}>최신 알림으로</Link> : null}
   {inbox.nextCursor ? <Link className="button button-secondary" href={notificationsUrl(filter,inbox.nextCursor)} prefetch={false}>이전 알림 더 보기</Link> : null}
  </nav>
 </>;
}
