"use client";
import { useActionState,useId,useState } from "react";
import { moderateReviewComment,revealModerationComment } from "@/lib/review-comments/actions";
import type { CommentModeration } from "@/lib/review-comments/model";
import { ActionForm,Checkbox } from "@/components/forms/action-form";
import { ReviewText } from "@/components/reviews/plain-text";
import { reportLabels } from "@/lib/reviews/model";
export function ModerationCommentBody({snapshot}:{snapshot:CommentModeration}) {
 const [state,action,pending]=useActionState(async()=>{
  try {return await revealModerationComment({id:snapshot.id,version:snapshot.version,confirm:true});}
  catch {return {ok:false as const,error:{message:"현재 댓글 본문을 확인하지 못했어요. 최신 검토 화면을 불러와 주세요."}};}
 },null);
 if (!snapshot.canModerate) return <p>현재 검토할 공개 댓글 본문이 없어요. 공개 취소·삭제한 리뷰와 삭제한 댓글의 원문은 제공하지 않아요.</p>;
 if (state?.ok) return <ReviewText body={state.body}/>;
 return <form action={action} className="review-body-gate"><p>댓글에 스포일러가 포함될 수 있어요. 검토할 때만 원문을 펼쳐 주세요.</p><button className="button button-secondary" disabled={pending}>{pending ? "확인 중…" : "검토용 댓글 원문 펼치기"}</button>{state && !state.ok ? <p role="alert">{state.error.message}</p> : null}</form>;
}
export function ModerateCommentForm({snapshot}:{snapshot:CommentModeration}) {
 const reports=snapshot.reports.filter(r=>r.status === "pending");
 const label=useId(),[operation,setOperation]=useState(snapshot.canModerate ? "hide" : "reject_report"),[reportId,setReportId]=useState(""),[reason,setReason]=useState(""),[result,setResult]=useState("");
 if (!snapshot.canModerate && !reports.length) return <p>현재 처리할 조치나 대기 신고가 없어요.</p>;
 return <ActionForm action={moderateReviewComment} submitLabel="댓글 운영 조치 기록"><input type="hidden" name="id" value={snapshot.id}/><input type="hidden" name="version" value={snapshot.version}/>
  <label className="form-field">조치<select name="operation" value={operation} onChange={e=>setOperation(e.target.value)}>{snapshot.canModerate ? <><option value="hide">댓글 숨김 · 원 댓글이면 답글도 숨김</option><option value="restore">댓글 숨김 해제</option></> : null}{reports.length ? <option value="reject_report">선택한 신고 기각</option> : null}</select></label>
  <label className="form-field">함께 처리할 신고<select name="reportId" value={reportId} onChange={e=>setReportId(e.target.value)}><option value="">신고 선택 안 함</option>{reports.map(r=><option key={r.id} value={r.id}>{reportLabels[r.reason]} · {r.createdAt}</option>)}</select></label>
  <label className="form-field" htmlFor={`${label}-reason`}>비공개 운영 사유 (2~1000자)<textarea id={`${label}-reason`} name="reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} rows={3} required/></label>
  <label className="form-field" htmlFor={`${label}-result`}>선택한 신고자에게 안내할 결과 (2~500자)<textarea id={`${label}-result`} name="result" value={result} onChange={e=>setResult(e.target.value)} maxLength={1000} rows={3}/></label>
  <Checkbox name="confirm" label="선택한 댓글·신고와 운영 사유를 확인했어요." required/>
 </ActionForm>;
}
