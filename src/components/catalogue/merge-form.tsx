"use client";
import { ActionForm,Checkbox,Textarea } from "@/components/forms/action-form";
import { mergeWorks } from "@/lib/catalogue/actions";
export function MergeForm({sourceId,targetId,sourceVersion,targetVersion}:{sourceId:string;targetId:string;sourceVersion:number;targetVersion:number}) {
  return <ActionForm action={mergeWorks} submitLabel="확인한 작품 병합">
    <input type="hidden" name="sourceId" value={sourceId}/><input type="hidden" name="targetId" value={targetId}/><input type="hidden" name="sourceVersion" value={sourceVersion}/><input type="hidden" name="targetVersion" value={targetVersion}/>
    <Textarea name="reason" label="동일 웹툰임을 확인한 근거와 병합 사유" maxLength={1000}/>
    <Checkbox name="confirm" label="원작 소설·리메이크·새 각색이 아닌 같은 웹툰임을 확인했으며, 위 결과로 병합해요." required/>
  </ActionForm>;
}
