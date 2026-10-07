"use client";
import Link from "next/link";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserFollow,reloadUserFollow } from "@/lib/social/actions";
import type { FollowState } from "@/lib/social/model";

export function FollowPanel({initial}:{initial:FollowState}) {
 // Revalidation/another viewer replaces all local acknowledgement state.
 return <FollowControls key={`${initial.id}:${initial.isSelf}:${initial.canFollow}:${initial.following}:${initial.followerCount}:${initial.followingCount}`} initial={initial}/>;
}
function FollowControls({initial}:{initial:FollowState}) {
 const router=useRouter();
 const [state,setState]=useState<FollowState|null>(initial),[message,setMessage]=useState(""),[pending,startTransition]=useTransition();
 const profilePath=`/u/${initial.username}`;
 function update() {
  const current=state;
  if (!current?.canFollow || pending) return;
  const following=!current.following;
  setMessage("");startTransition(async()=>{
   try {
    const reply=await setUserFollow({id:current.id,following});
    if (!reply.ok) {
     setMessage(reply.error.message);
     // A timeout/lost or malformed acknowledgement may already have committed.
     if (reply.error.code !== "RATE_LIMITED" && reply.error.code !== "VALIDATION_ERROR") setState(null);
     return;
    }
    setState(reply.state);setMessage(following ? "팔로우했어요." : "팔로우를 해제했어요.");
    if (reply.state === null) router.refresh();
   } catch {
    setState(null);setMessage("처리 결과를 확인하지 못했어요. 현재 상태를 다시 확인해 주세요.");
   }
  });
 }
 function reload() {
  if (pending) return;
  setMessage("");startTransition(async()=>{
   try {
    const reply=await reloadUserFollow({username:initial.username});
    if (!reply.ok) {setState(null);setMessage(reply.error.message);router.refresh();return;}
    if (reply.state.id !== initial.id) {setState(null);router.refresh();return;}
    setState(reply.state);router.refresh();
   } catch {setState(null);setMessage("현재 팔로우 상태를 확인하지 못했어요. 다시 시도해 주세요.");}
  });
 }
 return <section className="follow-panel" aria-label="팔로우와 공개 관계" aria-busy={pending}>
  {state ? <><nav className="follow-counts" aria-label="팔로워와 팔로잉 목록">
   <Link href={`${profilePath}/followers`}>팔로워 <strong>{state.followerCount.toLocaleString("ko-KR")}</strong></Link>
   <Link href={`${profilePath}/following`}>팔로잉 <strong>{state.followingCount.toLocaleString("ko-KR")}</strong></Link>
  </nav>{state.isSelf ? <p className="field-hint">내 프로필이에요.</p> : state.canFollow ? <button className="button button-secondary" type="button" aria-pressed={state.following} disabled={pending} onClick={update}>{pending ? "처리 중…" : state.following ? "팔로우 해제" : "팔로우"}</button> : <p className="field-hint"><Link className="text-link" href={`/auth/sign-in?returnTo=${encodeURIComponent(profilePath)}`}>로그인과 계정 확인</Link> 후 팔로우할 수 있어요.</p>}</> : <p>현재 팔로우 상태를 다시 확인해 주세요.</p>}
  <p className="field-hint">팔로우 관계는 공개돼요. 인원수와 목록은 현재 볼 수 있는 활성 계정 기준이에요.</p>
  <p role="status" aria-live="polite">{message}</p>
  <button className="text-link" type="button" disabled={pending} onClick={reload}>현재 팔로우 상태 다시 확인</button>
 </section>;
}
