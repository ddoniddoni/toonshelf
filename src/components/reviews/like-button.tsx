"use client";
import Link from "next/link";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { setReviewLike,reloadReviewLike } from "@/lib/reviews/like-actions";
import type { ReviewLikeState } from "@/lib/reviews/like-model";
export function ReviewLikeButton({initial,id,version,own,active}:{initial:ReviewLikeState|null;id:string;version:number;own:boolean;active:boolean}) {
 const router=useRouter();const [state,setState]=useState(initial),[message,setMessage]=useState(""),[pending,startTransition]=useTransition();
 const stale=state !== null && state.version !== version;
 function update() {
  if (!state || !state.canLike || stale || pending) return;
  setMessage("");startTransition(async()=>{
   try {
    const reply=await setReviewLike({id,version:state.version,liked:!state.liked});
    if (!reply.ok) {
     setMessage(reply.error.message);
     if (["CONFLICT","NOT_FOUND","AUTH_REQUIRED","FORBIDDEN","EMAIL_UNVERIFIED","ONBOARDING_REQUIRED","INTERNAL_ERROR","CONFIG_REQUIRED"].includes(reply.error.code)) setState(null);
     return;
    }
    setState(reply.state);setMessage(reply.state.liked ? "좋아요를 표시했어요." : "좋아요를 취소했어요.");
   } catch {
    // A lost response may have committed. Fetch before offering another write.
    setState(null);setMessage("처리 결과를 확인하지 못했어요. 현재 상태를 다시 확인해 주세요.");
   }
  });
 }
 function reload() {
  setMessage("");startTransition(async()=>{
   try {
    const reply=await reloadReviewLike({id});
    if (!reply.ok) {setState(null);setMessage(reply.error.message);return;}
    setState(reply.state);if (reply.state.version !== version) router.refresh();
   } catch {setState(null);setMessage("현재 좋아요 상태를 확인하지 못했어요. 다시 시도해 주세요.");}
  });
 }
 return <section className="tier-like-panel" aria-label="리뷰 좋아요" aria-busy={pending}>
  {state && !stale ? <div className="tier-like-controls"><button className="button button-secondary tier-like-button" type="button" aria-pressed={state.liked} disabled={pending || !state.canLike} onClick={update}><Heart size={17} fill={state.liked ? "currentColor" : "none"} aria-hidden="true"/>{pending ? "확인 중…" : state.liked ? "좋아요 취소" : "좋아요"}</button><span aria-live="polite">좋아요 {state.likeCount.toLocaleString("ko-KR")}개</span></div> : <p>현재 좋아요 정보를 다시 확인해 주세요.</p>}
  {own ? <p className="field-hint">내 리뷰에는 좋아요를 표시할 수 없어요.</p> : !active ? <p className="field-hint"><Link className="text-link" href={`/auth/sign-in?returnTo=${encodeURIComponent(`/reviews/${id}`)}`}>로그인과 계정 확인</Link> 후 좋아요를 표시할 수 있어요.</p> : null}
  <p role="status" aria-live="polite">{message}</p>
  <button className="text-link" type="button" disabled={pending} onClick={reload}>현재 좋아요 상태 다시 확인</button>
 </section>;
}
