"use client";
import { ActionForm,Checkbox } from "@/components/forms/action-form";
import { deleteMergeHistory } from "@/lib/library/merge-history-actions";
export function MergeHistoryDelete({id}:{id:string}) {
 return <ActionForm action={deleteMergeHistory} submitLabel="보관한 원본 기록 삭제">
  <input type="hidden" name="id" value={id}/>
  <Checkbox name="confirm" label="이 이력에 보관한 원본 기록을 삭제해요. 현재 서재·평가·리뷰는 유지돼요." required/>
 </ActionForm>;
}
