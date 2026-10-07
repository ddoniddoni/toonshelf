"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead,markAllNotificationsRead } from "@/lib/notifications/actions";
type Target={kind:"one";id:string}|{kind:"all";through:string};
export function NotificationReadControl({target}:{target:Target}) {
 const router=useRouter();
 const [state,action,pending]=useActionState(async()=>{
  try {
   const result=target.kind==="one" ? await markNotificationRead({id:target.id}) : await markAllNotificationsRead({through:target.through});
   if (!result.ok) return {ok:false,message:result.error.message};
   router.refresh();return {ok:true,message:target.kind==="one" ? "읽음으로 표시했어요." : "페이지를 불러온 시점까지의 알림을 읽음으로 표시했어요."};
  } catch {return {ok:false,message:"처리 결과를 확인하지 못했어요. 새로고침해서 현재 상태를 확인해 주세요."};}
 },null);
 return <form action={action} className="notification-read-control"><button className="button button-secondary" disabled={pending || state?.ok===true}>
  {pending ? "처리 중…" : target.kind==="one" ? "읽음으로 표시" : "모두 읽음"}
 </button>{state ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}</form>;
}
export function NotificationRefresh() {
 const router=useRouter();
 return <button type="button" className="text-link" onClick={()=>router.refresh()}>새로고침</button>;
}
