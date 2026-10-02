"use client";
import Link from "next/link";
import { useState } from "react";
import { ActionForm,Checkbox,Field,Select } from "@/components/forms/action-form";
import { bulkLibraryChange } from "@/lib/library/actions";
import { readingLabels,type ReadingRecord } from "@/lib/library/model";
export function BulkLibraryForm({items,view="list"}:{items:ReadingRecord[];view?:"list"|"cards"}) {
 const [operation,setOperation] = useState("status");
 return <ActionForm action={bulkLibraryChange} submitLabel="선택한 기록에 적용">
  <fieldset className={"library-selection library-view-"+view}><legend>작품 선택 (현재 페이지, 최대 24개)</legend>{items.map(item=><div className="library-record" key={item.workId}>
   <label className="form-checkbox"><input type="checkbox" name="selection" value={item.workId+":"+item.version}/><span><strong>{item.work?.title ?? "현재 공개할 수 없는 작품"}</strong><span className="library-record-meta">{readingLabels[item.status]} · 서재 {item.libraryVisibility === "public" ? "공개" : "비공개"} · 평가 {item.evaluationVisibility === "public" ? "공개" : "비공개"}</span></span></label>
   <div className="library-record-evaluation"><span>{item.ratingSteps === null ? "별점 미지정" : (item.ratingSteps/2).toFixed(1)+"점"}</span><span>{item.canonicalTier ? "티어 "+item.canonicalTier : "티어 미지정"}</span></div>
   <p className="field-hint">{item.episode === null ? "" : item.episode+"회차 · "}{item.tags.join(" · ") || "개인 태그 없음"}</p><Link className="text-link" href={"/me/library/"+item.workId}>기록 {item.work ? "편집" : "확인"} →</Link>
  </div>)}</fieldset>
  <div className="form-field"><label htmlFor="bulk-operation">선택한 작품에 할 작업</label><select id="bulk-operation" name="operation" value={operation} onChange={e=>setOperation(e.target.value)}><option value="status">읽기 상태 변경</option><option value="tag">개인 태그 추가</option><option value="libraryVisibility">서재 공개 범위 변경</option><option value="evaluationVisibility">평가 공개 범위 변경</option><option value="delete">서재 삭제</option></select></div>
  {operation === "status" ? <Select key="status" name="value" label="새 읽기 상태">{Object.entries(readingLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select> : operation === "tag" ? <Field name="value" label="추가할 개인 태그" maxLength={40} required/> : operation === "delete" ? <input name="value" type="hidden" value=""/> : <Select key="visibility" name="value" label="새 공개 범위"><option value="private">나만 보기</option><option value="public">공개</option></Select>}
  <p className="field-hint">모두 함께 적용돼요. 바뀐 기록이 하나라도 있으면 전체 요청을 중단하고 최신 기록을 확인하도록 안내해요.</p>
  {operation === "delete" ? <><p className="reading-warning">선택한 서재와 회차·날짜·메모·태그·별점·기본 티어가 함께 삭제돼요. 별도 리뷰와 티어표는 유지돼요.</p><Checkbox name="confirm" required label="선택한 개인 기록과 평가 삭제에 동의해요"/></> : operation === "status" ? <Checkbox name="confirm" label="나중에 볼 작품으로 변경할 때 기존 별점·기본 티어 삭제에 동의해요"/> : null}
 </ActionForm>;
}
