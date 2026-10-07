import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentAccount } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/notifications/data";
export function NotificationBellLink({count=null,unavailable=false}:{count?:number|null;unavailable?:boolean}) {
 const label=unavailable ? "알림 · 개수를 확인하지 못했어요" : count===null ? "알림" : `알림 · 읽지 않음 ${count}개`;
 return <Link className="header-icon notification-bell" href="/me/notifications" prefetch={false} aria-label={label} title={label}>
  <Bell size={18} aria-hidden="true"/>{count!==null && count>0 ? <span className="notification-badge" aria-hidden="true">{count>99 ? "99+" : count}</span> : null}
 </Link>;
}
export async function NotificationBell() {
 try {
  const account=await getCurrentAccount();
  if (!account || account.access.status!=="active" || !account.access.consents_current || !account.user.email_confirmed_at) return <NotificationBellLink/>;
  return <NotificationBellLink count={await getUnreadNotificationCount()}/>;
 } catch {return <NotificationBellLink unavailable/>;}
}
