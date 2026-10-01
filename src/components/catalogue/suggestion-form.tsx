"use client";
import { ActionForm,Field,Select,Textarea } from "@/components/forms/action-form";
import { submitSuggestion,reviewSuggestion } from "@/lib/catalogue/actions";
export function SuggestionForm({workId,workTitle}:{workId:string|null;workTitle?:string}) {
  return <ActionForm action={submitSuggestion} submitLabel="검수 요청 보내기">
    <input type="hidden" name="workId" value={workId ?? ""}/>
    {workId ? <><p>대상 작품: <strong>{workTitle}</strong></p><Select name="kind" label="제보 종류" defaultValue="correction"><option value="correction">작품 정보 수정</option><option value="broken_link">사라진 공식 링크</option></Select></> : <><input type="hidden" name="kind" value="new_work"/><p>새 작품 추가를 제안해요.</p></>}
    <Field name="sourceUrl" type="url" label="확인 가능한 출처 주소 (HTTPS)" required maxLength={2048}/>
    <Textarea name="proposal" label="작품 제목·수정할 내용과 근거 (10~5000자)" maxLength={10000}/>
    <p className="field-hint">소개문·표지 이미지를 복사해 붙이지 마세요. 제보는 바로 공개되지 않으며 관리자가 출처를 확인한 뒤 반영해요.</p>
  </ActionForm>;
}
export function ReviewForm({id,works}:{id:string;works:{id:string;title:string}[]}) {
  return <ActionForm action={reviewSuggestion} submitLabel="검수 결과 저장"><input type="hidden" name="id" value={id}/>
    <Select name="status" label="검수 결과" defaultValue="rejected"><option value="accepted">반영</option><option value="rejected">미반영</option></Select>
    <Select name="resultWorkId" label="반영한 공개 작품 · 반영 시 필수"><option value="">미반영</option>{works.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</Select>
    <Textarea name="note" label="제보자에게 전달할 처리 결과 · 비공개 정보 제외" maxLength={1000}/>
    <p className="field-hint">반영을 선택하기 전에 작품 정보를 직접 수정해 주세요. 이 동작은 작품을 자동으로 등록하지 않아요.</p>
  </ActionForm>;
}
