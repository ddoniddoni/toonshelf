"use client";
import { useState } from "react";
import { ActionForm,Checkbox,Field,Select,Textarea } from "@/components/forms/action-form";
import { saveReadingRecord,copyWorkToLibrary,makeAllLibraryPrivate } from "@/lib/library/actions";
import { readingLabels,type ReadingRecord } from "@/lib/library/model";
import type { WorkDetail } from "@/lib/catalogue/model";
export function CopyToLibrary({workId}:{workId:string}) {
 return <ActionForm action={copyWorkToLibrary} submitLabel="내 서재에 저장"><input type="hidden" name="workId" value={workId}/><p className="field-hint">나중에 볼 작품으로 저장해요. 다른 사람의 평가·기록은 복사하지 않아요. 이미 저장했다면 내 기록을 유지해요.</p></ActionForm>;
}
export function RecordForm({work,record,defaults}:{work:WorkDetail;record:ReadingRecord|null;defaults:{library:string;evaluation:string}}) {
 const [status,setStatus] = useState(record?.status ?? "planned");
 const hasEvaluation = record?.ratingSteps != null || record?.canonicalTier != null;
 return <ActionForm action={saveReadingRecord} submitLabel="내 기록 저장">
  <input type="hidden" name="workId" value={work.id}/><input type="hidden" name="version" value={record?.version ?? ""}/>
  <div className="form-field"><label htmlFor="reading-status">읽기 상태</label><select id="reading-status" name="status" value={status} onChange={e=>setStatus(e.target.value as typeof status)}>{Object.entries(readingLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
  {status === "completed" && work.serialStatus !== "completed" ? <p className="field-hint">내가 읽기를 마쳤다는 기록이에요. 작품 자체의 연재 완료와는 달라요.</p> : null}
  <div className="form-columns"><Select name="libraryVisibility" label="서재 작품과 읽기 상태" defaultValue={record?.libraryVisibility ?? defaults.library}><option value="private">나만 보기</option><option value="public">공개</option></Select><Select name="evaluationVisibility" label="별점과 기본 티어" defaultValue={record?.evaluationVisibility ?? defaults.evaluation}><option value="private">나만 보기</option><option value="public">공개</option></Select></div>
  <p className="field-hint">서재 상태와 평가는 따로 공개할 수 있어요. 공개 평가는 작품 전체 통계에 반영돼요.</p>
  {status === "planned" ? <><input type="hidden" name="ratingSteps" value=""/><input type="hidden" name="canonicalTier" value=""/><p className="reading-warning">나중에 볼 작품에는 별점·기본 티어를 남기지 않아요.</p>{hasEvaluation ? <Checkbox name="clearEvaluation" required label="기존 별점과 기본 티어를 삭제하고 나중에 볼 작품으로 바꿀게요"/> : null}</> :
   <div className="form-columns"><Select name="ratingSteps" label="내 별점" defaultValue={record?.ratingSteps?.toString() ?? ""}><option value="">미지정 / 별점 취소</option>{Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{((i+1)/2).toFixed(1)}점</option>)}</Select><Select name="canonicalTier" label="내 기본 티어" defaultValue={record?.canonicalTier ?? ""}><option value="">미지정 / 티어 취소</option>{["S","A","B","C","D","F"].map(t=><option key={t}>{t}</option>)}</Select></div>}
  <fieldset className="private-reading-fields"><legend>나만 보는 진행 기록</legend><p className="field-hint">회차·날짜·메모·개인 태그·읽는 플랫폼은 공개 서재나 평가에 표시하지 않아요.</p>
   <div className="form-columns"><Field name="episode" label="마지막 읽은 회차" type="number" min={0} max={1000000} step={1} defaultValue={record?.episode ?? ""}/><Select name="preferredLink" label="내가 읽는 플랫폼" defaultValue={record?.preferredLink && work.links.some(l=>l.id === record.preferredLink) ? record.preferredLink : ""}><option value="">미지정</option>{work.links.map(l=><option value={l.id} key={l.id}>{l.platformName}</option>)}</Select></div>
   <div className="form-columns"><Field name="startedOn" label="읽기 시작일" type="date" defaultValue={record?.startedOn ?? ""}/><Field name="finishedOn" label="읽기 종료일" type="date" defaultValue={record?.finishedOn ?? ""}/></div>
   <Textarea name="note" label="비공개 메모" defaultValue={record?.note ?? ""} maxLength={10000}/><Textarea name="tags" label="개인 태그 (한 줄에 하나, 최대 20개·각 20자)" defaultValue={record?.tags.join("\n") ?? ""} maxLength={840}/>
  </fieldset><p className="field-hint">공유 티어표를 편집해도 이 기본 평가가 자동으로 바뀌지 않아요.</p>
 </ActionForm>;
}
export function AllPrivateForm() {
 return <ActionForm action={makeAllLibraryPrivate} submitLabel="모든 서재와 평가 비공개로 변경"><p>기존 서재와 평가, 새 기록의 기본 공개 범위를 함께 나만 보기로 바꿔요. 별도로 게시한 리뷰·티어표에는 적용하지 않아요.</p><Checkbox name="confirm" required label="서재와 평가를 모두 비공개로 바꿀게요"/></ActionForm>;
}
