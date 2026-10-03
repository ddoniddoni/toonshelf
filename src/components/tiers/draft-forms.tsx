"use client";
import Link from "next/link";
import { ActionForm,Checkbox,Field } from "@/components/forms/action-form";
import { copyTierDraft,createTierDraft,deleteTierDraft } from "@/lib/tiers/actions";
export function NewTierForm() {
 return <ActionForm action={createTierDraft} submitLabel="비공개 티어표 만들기"><Field label="제목" name="title" required defaultValue="나만의 웹툰 티어표" maxLength={160}/><p className="field-hint">S·A·B·C·D·F 행으로 시작해요. 최대 50개 티어표, 티어표당 300개 작품을 저장할 수 있어요.</p></ActionForm>;
}
export function TierDraftActions({id,version}:{id:string;version:number}) {
 return <div className="tier-list-actions"><Link className="button button-secondary" href={`/tiers/${id}/publish`}>게시·공유 설정</Link><ActionForm action={copyTierDraft} submitLabel="이 초안 복사"><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/></ActionForm><details><summary>티어표 삭제</summary><ActionForm action={deleteTierDraft} submitLabel="티어표 삭제"><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><Checkbox name="confirm" required label="이 티어표의 초안·게시본·공유 링크·병합 원본 이력을 삭제할게요. 서재와 기본 평가는 유지돼요."/></ActionForm></details></div>;
}
