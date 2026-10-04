"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { setFeaturedTier } from "@/lib/tiers/featured-actions";
import type { FeaturedState } from "@/lib/tiers/featured-model";
import type { PublicationState } from "@/lib/tiers/publication-model";

export function FeaturedTierControl({featured,tier,disabled=false}:{featured:FeaturedState;tier?:PublicationState;disabled?:boolean}) {
 const router=useRouter();
 const eligible=tier?.visibility === "public" && tier.moderationStatus === "visible" && tier.publishedVersion !== null;
 const selected=eligible && featured.id === tier?.id;
 const [feedback,action,pending]=useActionState(async(_previous:{ok:boolean;message:string}|null,form:FormData)=>{
  const operation=form.get("operation");
  if (operation !== "select" && operation !== "clear") return {ok:false,message:"작업 종류를 확인해 주세요."};
  if (operation === "select" && (!tier || !eligible)) return {ok:false,message:"현재 전체 공개된 내 티어표만 대표로 지정할 수 있어요."};
  try {
   const reply=await setFeaturedTier({id:operation === "select" ? tier!.id : null,tierVersion:operation === "select" ? tier!.version : null,featuredVersion:featured.version});
   if (!reply.ok) return {ok:false,message:reply.error.message};
   router.refresh();return {ok:true,message:reply.state.id === null ? "대표 티어표 지정을 해제했어요." : "공개 프로필의 대표 티어표로 지정했어요."};
  } catch {return {ok:false,message:"처리 결과를 확인하지 못했어요. 최신 상태를 불러와 주세요."};}
 },null);
 // After any reply, use a fresh server revision before allowing another write.
 const busy=disabled || pending || feedback !== null;
 return <section className="library-privacy-panel" aria-labelledby="featured-tier-title">
  <h2 id="featured-tier-title">프로필 대표 티어표</h2>
  {feedback ? <p>다음 변경 전에 최신 대표 지정을 불러와 주세요.</p> : selected ? <p>이 티어표가 내 공개 프로필의 대표 티어표예요.</p> : featured.id && featured.id !== tier?.id ? <p><Link href={`/tiers/${featured.id}/publish`} prefetch={false} className="text-link">현재 대표 티어표 관리 →</Link></p> : <p>전체 공개된 내 티어표 하나를 골라 프로필에 보여 주세요.</p>}
  <p className="field-hint">항상 현재 게시본을 표시해요. 링크 공개·비공개 전환, 삭제, 운영 숨김 때 대표 지정도 해제돼요. 다시 공개해도 자동으로 지정되지 않아요.</p>
  <form action={action} aria-busy={pending}><fieldset disabled={busy}>
   {tier && eligible && !selected ? <button className="button button-primary" name="operation" value="select">{featured.id ? "이 티어표로 대표 변경" : "이 티어표를 대표로 지정"}</button> : null}
   {tier && !eligible ? <p>대표 지정은 전체 공개로 게시한 뒤 가능해요.</p> : null}
   {featured.id ? <button className="button button-secondary" name="operation" value="clear">대표 지정 해제</button> : null}
  </fieldset></form>
  <p role={feedback && !feedback.ok ? "alert" : "status"} aria-live="polite">{pending ? "대표 지정을 저장하는 중…" : feedback?.message}</p>
  <button type="button" className="text-link" disabled={disabled || pending} onClick={()=>window.location.reload()}>최신 대표 지정 불러오기</button>
 </section>;
}
