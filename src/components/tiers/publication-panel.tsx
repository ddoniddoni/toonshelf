"use client";
import Link from "next/link";
import { startTransition,useActionState,useState } from "react";
import { useRouter } from "next/navigation";
import { getTierShareUrl,publishTier,rotateTierLink,withdrawTier } from "@/lib/tiers/publication-actions";
import type { PublicationPreview } from "@/lib/tiers/publication-model";
import { PublicationBoard } from "./publication-board";

export function PublicationPanel({preview,siteUrl}:{preview:PublicationPreview;siteUrl:string}) {
 const router=useRouter();const [state,setState]=useState(preview.state),[url,setUrl]=useState(""),[message,setMessage]=useState(""),[linkBusy,setLinkBusy]=useState(false);
 const [feedback,action,pending]=useActionState(async(_previous:{ok:boolean;message:string}|null,form:FormData)=>{
  setUrl("");setMessage("");
  const operation=form.get("operation"),confirmed=form.get("confirm") === "on";
  if (operation !== "publish" && operation !== "rotate" && operation !== "withdraw") return {ok:false,message:"작업 종류를 확인해 주세요."};
  try {
  const input={id:state.id,version:state.version,confirm:confirmed};
  const reply=operation === "publish" ? await publishTier({id:state.id,draftVersion:preview.draftVersion,listVersion:state.version,
   fingerprint:preview.fingerprint,visibility:form.get("visibility"),isSpoiler:form.get("isSpoiler") === "on",confirm:confirmed})
   : operation === "rotate" ? await rotateTierLink(input) : await withdrawTier(input);
  if (!reply.ok) return {ok:false,message:reply.error.message};
  setState(reply.state);return {ok:true,message:operation === "publish" ? "저장된 초안을 게시했어요. 링크 공개는 새 공유 링크를 확인해 주세요." : operation === "rotate" ? "이전 링크를 철회했어요. 새 공유 링크를 확인해 주세요." : "비공개로 전환했어요. 초안과 게시 이력은 유지돼요."};
  } catch {return {ok:false,message:"처리 결과를 확인하지 못했어요. 최신 상태와 미리보기를 불러와 주세요."};}
 },null);
 function obtainLink() {
  setLinkBusy(true);setMessage("");startTransition(async()=>{
   try {
    if (state.visibility === "public") {setUrl(new URL(`/tiers/${state.id}`,siteUrl).href);setMessage("공개 게시본의 주소예요.");return;}
    const reply=await getTierShareUrl({id:state.id,version:state.version});if (!reply.ok) {setUrl("");setMessage(reply.error.message);return;}
    setUrl(reply.url);setMessage("링크를 아는 사람은 게시본을 볼 수 있어요. 필요한 사람에게만 공유해 주세요.");
   } catch {setUrl("");setMessage("공유 링크를 확인하지 못했어요. 다시 시도해 주세요.");} finally {setLinkBusy(false);}
  });
 }
 async function copy() {try {await navigator.clipboard.writeText(url);setMessage("주소를 복사했어요.");} catch {setMessage("아래 주소를 선택해서 직접 복사해 주세요.");}}
 async function share() {try {if (!navigator.share) {setMessage("이 브라우저에서는 주소 복사를 이용해 주세요.");return;}await navigator.share({title:"ToonShelf 티어표",url});} catch(error) {if (!(error instanceof Error && error.name === "AbortError")) setMessage("주소 복사로 공유해 주세요.");}}
 const busy=pending || linkBusy,canPublish=state.moderationStatus === "visible";
 return <div className="tier-publication-panel"><p><span className="section-chip">{state.visibility === "public" ? "전체 공개" : state.visibility === "unlisted" ? "링크 공개" : "비공개"}</span> {state.publishedVersion ? `게시본 ${state.publishedVersion}` : "아직 게시하지 않았어요"}</p>
  <p>마지막으로 저장한 초안 버전 {preview.draftVersion}의 미리보기예요. 미배치 작품은 제외했어요. 게시해도 개인 별점·기본 평가는 바뀌지 않아요.</p>
  <PublicationBoard body={preview.body}/>
  {canPublish ? <form action={action} className="account-form" aria-busy={pending}><fieldset disabled={busy}><input type="hidden" name="operation" value="publish"/>
   <label className="form-field">공개 범위<select name="visibility" defaultValue={state.visibility === "unlisted" ? "unlisted" : "public"}><option value="public">전체 공개 · 공개 목록에 표시</option><option value="unlisted">링크 공개 · 링크를 아는 사람만 열람</option></select></label>
   <label className="form-checkbox"><input type="checkbox" name="isSpoiler" defaultChecked/><span>제목·설명·배치에 스포일러가 포함돼요. 직접 펼친 뒤 보여 주세요.</span></label>
   <label className="form-checkbox"><input type="checkbox" name="confirm" required/><span>위 저장된 초안과 공개 범위를 확인했으며 게시에 동의해요.</span></label>
   <p className="field-hint">링크 공개로 게시하거나 업데이트할 때마다 새 링크를 발급하고 이전 링크는 철회해요. 이 페이지를 연 뒤 초안·공개 설정이 바뀌면 다시 미리보기를 확인해야 해요.</p>
   <button className="button button-primary" type="submit">{pending ? "처리 중…" : state.publishedVersion ? "게시본 업데이트" : "이 초안 게시하기"}</button>
  </fieldset></form> : <p className="reading-warning">운영자가 숨긴 티어표예요. 초안은 편집할 수 있지만 직접 재게시할 수 없어요.</p>}
  <div role={feedback && !feedback.ok ? "alert" : "status"} aria-live="polite">{feedback?.message}</div>
  <button className="button button-secondary" disabled={busy} onClick={()=>router.refresh()}>최신 상태와 미리보기 불러오기</button>
  {state.visibility !== "private" && canPublish && (state.visibility === "public" || state.hasShareToken) ? <section className="tier-share-panel"><h2>게시본 공유</h2><button className="button button-secondary" disabled={busy} onClick={obtainLink}>{linkBusy ? "확인 중…" : "공유 주소 확인"}</button>{url ? <><label className="form-field">공유 주소<input readOnly value={url} onFocus={e=>e.currentTarget.select()}/></label><div className="tier-list-actions"><button className="button button-primary" disabled={busy} onClick={copy}>주소 복사</button><button className="button button-secondary" disabled={busy} onClick={share}>기기 공유 메뉴</button><a href={url} rel="noreferrer" target="_blank" className="text-link">게시본 열기 ↗</a></div></> : null}<p role="status" aria-live="polite">{message}</p></section> : null}
  {state.visibility === "unlisted" && canPublish ? <details className="library-privacy-panel"><summary>{state.hasShareToken ? "공유 링크 새로 발급" : "철회된 링크 대신 새 링크 발급"}</summary><form action={action} className="account-form"><fieldset disabled={busy}><input type="hidden" name="operation" value="rotate"/><label className="form-checkbox"><input name="confirm" type="checkbox" required/><span>이전 링크를 철회하고 새 링크를 발급할게요.</span></label><button className="button button-secondary">새 링크 발급</button></fieldset></form></details> : null}
  {state.visibility !== "private" ? <details className="library-privacy-panel"><summary>게시 취소 · 비공개로 전환</summary><form action={action} className="account-form"><fieldset disabled={busy}><input type="hidden" name="operation" value="withdraw"/><label className="form-checkbox"><input name="confirm" type="checkbox" required/><span>공개 목록과 상세에서 숨기고 기존 공유 링크를 철회할게요.</span></label><button className="button button-secondary">비공개로 전환</button></fieldset></form></details> : null}
  <Link className="text-link" href={`/tiers/${state.id}/edit`}>← 초안 편집으로 돌아가기</Link>
 </div>;
}
