"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewTierEvaluations,commitTierEvaluations } from "@/lib/tiers/evaluation-actions";
import { evaluatedStatusSchema,skipLabels,type EvaluationContext,type EvaluationChoice,type EvaluationPreview } from "@/lib/tiers/evaluation-model";
import { readingLabels } from "@/lib/library/model";

export function EvaluationPanel({context}:{context:EvaluationContext}) {
 const [message,setMessage]=useState("");
 // Changing context remounts only the selection, preserving operation feedback.
 return <div className="tier-evaluation-panel"><p>{context.mode === "import"
  ? "선택한 내 기본 티어를 같은 코드의 행으로 가져와요. 이미 배치된 작품은 그 행의 끝으로 옮기고, 다른 작품의 순서는 유지해요. 개인 평가와 게시본은 바뀌지 않아요."
  : "선택한 작품의 기본 티어만 이 초안의 코드로 바꿔요. 기존 별점·읽기 상태·공개 범위·메모는 유지해요. 새 서재 기록과 새 평가는 비공개로 만들어요. 다른 티어표의 배치나 게시본은 바뀌지 않아요."}</p>
  <p className="field-hint">행 이름이나 색상으로 티어를 추정하지 않아요. 명시된 S/A/B/C/D/F 코드가 있어야 연결할 수 있어요.</p>
  <p role="status" aria-live="polite">{message}</p>
  <EvaluationSelection key={JSON.stringify(context)} context={context} onDone={setMessage}/>
 </div>;
}
function EvaluationSelection({context,onDone}:{context:EvaluationContext;onDone:(message:string)=>void}) {
 const router=useRouter();const [choices,setChoices]=useState<EvaluationChoice[]>([]),[preview,setPreview]=useState<EvaluationPreview|null>(null);
 const [confirmed,setConfirmed]=useState(false),[message,setMessage]=useState(""),[pending,startTransition]=useTransition();
 function change(workId:string,selected:boolean,status:EvaluationChoice["status"]=null) {
  setPreview(null);setConfirmed(false);setMessage("");onDone("");
  setChoices(items=>selected ? [...items.filter(item=>item.workId !== workId),{workId,status}] : items.filter(item=>item.workId !== workId));
 }
 function prepare() {
  setMessage("");setPreview(null);setConfirmed(false);onDone("");
  startTransition(async()=>{
   try {
    const reply=await previewTierEvaluations({id:context.id,mode:context.mode,version:context.version,choices});
    if (!reply.ok) {setMessage(reply.error.message);return;}setPreview(reply.preview);
   } catch {setMessage("변경 내용을 불러오지 못했어요. 최신 목록을 다시 불러와 주세요.");}
  });
 }
 function commit() {
  if (!preview || !confirmed) return;
  startTransition(async()=>{
   try {
    const reply=await commitTierEvaluations({id:preview.id,mode:preview.mode,version:preview.version,choices,fingerprint:preview.fingerprint,confirm:confirmed});
    // Always require a fresh preview after any response, including ambiguous errors.
    setPreview(null);setConfirmed(false);
    if (!reply.ok) {setMessage(reply.error.message);return;}
    setChoices([]);onDone(`${reply.changed}개 작품을 ${context.mode === "import" ? "초안에 가져왔어요. 게시본은 별도로 업데이트해 주세요." : "내 기본 평가에 반영했어요."}`);router.refresh();
   } catch {setPreview(null);setConfirmed(false);setMessage("처리 결과를 확인하지 못했어요. 최신 목록을 불러와 실제 반영 상태를 확인해 주세요.");}
  });
 }
 const missingStatus=choices.some(choice=>context.items.find(item=>item.workId === choice.workId)?.requiresStatus && !choice.status);
 return <section aria-label="기본 평가 변경 선택" aria-busy={pending}>
  <fieldset disabled={pending} className="tier-evaluation-choices"><legend>{context.mode === "import" ? "가져올 내 기본 티어" : "기본 평가에 반영할 작품"}</legend>
   {context.items.map(item=>{
    const choice=choices.find(choice=>choice.workId === item.workId);
    return <article className="tier-evaluation-item" key={item.workId}><label className="form-checkbox"><input type="checkbox" checked={Boolean(choice)} disabled={item.reason !== null} onChange={event=>change(item.workId,event.target.checked)}/><span><strong>{item.title ?? "현재 이용할 수 없는 작품"}</strong><span className="tier-evaluation-change">{context.mode === "import" ? `${item.fromRow ?? "초안에 없음"} → ${item.toRow ?? "대응 행 없음"} (내 기본 ${item.sourceTier})` : `내 기본 ${item.sourceTier ?? "없음"} → ${item.targetTier ?? "반영 제외"} · ${item.toRow ?? "미배치"}`}</span></span></label>
     {item.reason ? <p className="field-hint">{skipLabels[item.reason]}</p> : <><p className="field-hint">{item.status ? readingLabels[item.status] : "새 서재 기록"} · 별점 {item.ratingSteps ? `${item.ratingSteps/2}점 유지` : "없음"} · 서재 {item.libraryVisibility === "public" ? "공개 유지" : "비공개"} / 평가 {item.evaluationVisibility === "public" ? "공개 유지" : "비공개"}</p>
      {item.requiresStatus ? <label className="form-field">읽기 상태 선택 · 필수<select aria-label={`${item.title} 읽기 상태`} disabled={!choice} value={choice?.status ?? ""} onChange={event=>change(item.workId,true,evaluatedStatusSchema.parse(event.target.value))}><option value="" disabled>직접 선택해 주세요</option><option value="reading">보는 중</option><option value="completed">완독</option><option value="dropped">중도하차</option></select></label> : null}</>}
    </article>;
   })}
   {!context.items.length ? <p>{context.mode === "import" ? "이 페이지에는 기본 티어가 있는 내 평가가 없어요." : "이 페이지에는 초안 작품이 없어요."}</p> : null}
   <p>{choices.length}개 선택{missingStatus ? " · 필요한 읽기 상태를 선택해 주세요." : ""}</p>
   <button className="button button-primary" disabled={!choices.length || missingStatus} onClick={prepare}>{pending ? "처리 중…" : "변경 목록 미리보기"}</button>
  </fieldset>
  {preview ? <div className="tier-evaluation-preview"><h2>반영 전 확인 · {preview.items.length}개 작품</h2><ul>{preview.items.map(item=><li key={item.workId}><strong>{item.title}</strong> — {context.mode === "import" ? `${item.fromRow ?? "초안에 없음"} → ${item.toRow} (기본 ${item.targetTier})` : `기본 ${item.sourceTier ?? "없음"} → ${item.targetTier} · ${item.nextStatus ? readingLabels[item.nextStatus] : ""}`}<p className="field-hint">별점 {item.ratingSteps ? `${item.ratingSteps/2}점 유지` : "없음 유지"} · {item.evaluationVisibility === "public" ? "평가 공개 유지" : "평가 비공개"}</p></li>)}</ul>
   <label className="form-checkbox"><input type="checkbox" disabled={pending} checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>{context.mode === "import" ? "위 작품의 초안 배치 변경을 확인하고 가져오기에 동의해요." : "위 작품의 기본 티어·읽기 상태·공개 범위를 확인하고 개인 평가 반영에 동의해요."}</span></label>
   <button className="button button-primary" disabled={pending || !confirmed} onClick={commit}>{pending ? "처리 중…" : context.mode === "import" ? "확인한 기본 티어 가져오기" : "확인한 개인 평가 반영"}</button>
  </div> : null}
  <p role="alert">{message}</p><button className="button button-secondary" disabled={pending} onClick={()=>{setPreview(null);setConfirmed(false);router.refresh();}}>최신 목록 다시 불러오기</button>
 </section>;
}
