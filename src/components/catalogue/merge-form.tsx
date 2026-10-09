"use client";
import { ActionForm,Checkbox,Textarea } from "@/components/forms/action-form";
import { mergeWorks } from "@/lib/catalogue/actions";
export function MergeForm({sourceId,targetId,sourceVersion,targetVersion,previewToken}:{sourceId:string;targetId:string;sourceVersion:number;targetVersion:number;previewToken:string}) {
  return <ActionForm action={mergeWorks} submitLabel="확인한 작품 병합">
    <input type="hidden" name="sourceId" value={sourceId}/><input type="hidden" name="targetId" value={targetId}/><input type="hidden" name="sourceVersion" value={sourceVersion}/><input type="hidden" name="targetVersion" value={targetVersion}/>
    <input type="hidden" name="previewToken" value={previewToken}/><input type="hidden" name="conflictPolicy" value="latest_private"/>
    <Checkbox name="confirmPolicy" label="최신 상태·평가·진행 기록을 선택하고(같은 시각이면 남길 작품), 공개 범위는 더 제한적인 쪽을 유지해요. 메모·태그는 합치며 원래 기록은 본인 전용 병합 이력에 보관해요." required/>
    <p className="field-hint">커뮤니티 글과 초안은 작품 연결만 정리해요. 두 작품을 모두 연결했다면 먼저 나온 위치에 남길 작품 하나를 유지해요.</p>
    <Textarea name="reason" label="동일 웹툰임을 확인한 근거와 병합 사유" maxLength={1000}/>
    <Checkbox name="confirm" label="원작 소설·리메이크·새 각색이 아닌 같은 웹툰임을 확인했으며, 위 결과로 병합해요." required/>
  </ActionForm>;
}
