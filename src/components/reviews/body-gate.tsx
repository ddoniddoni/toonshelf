"use client";
import { useActionState } from "react";
import { revealReviewBody,revealModerationBody } from "@/lib/reviews/actions";
import { ReviewText } from "./plain-text";
export function ReviewBodyGate({id,version,moderation=false}:{id:string;version:number;moderation?:boolean}) {
 const [state,action,pending] = useActionState(moderation ? revealModerationBody : revealReviewBody,null);
 if (state?.ok) return <ReviewText body={state.body}/>;
 return <form action={action} className="review-body-gate" aria-busy={pending}><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><input type="hidden" name="confirm" value="on"/>
  <p>{moderation ? "게시된 본문만 검토할 수 있어요. 비공개 수정 초안은 제공하지 않아요." : "스포일러가 포함된 리뷰예요. 내용을 열면 작품의 전개를 알게 될 수 있어요."}</p>
  <button className="button button-secondary" type="submit" disabled={pending}>{pending ? "확인 중…" : moderation ? "현재 게시 본문 확인" : "스포일러를 확인하고 본문 펼치기"}</button>
  {state && !state.ok ? <p role="alert">{state.message}</p> : null}
 </form>;
}
