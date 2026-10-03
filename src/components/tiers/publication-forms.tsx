"use client";
import { ActionForm,Checkbox,Select,Textarea } from "@/components/forms/action-form";
import { clonePublishedTier,reportTier,moderateTier } from "@/lib/tiers/publication-actions";
import { reportLabels } from "@/lib/reviews/model";
import type { TierModeration } from "@/lib/tiers/publication-model";
export function CloneTierForm({id,version,token}:{id:string;version:number;token:string|null}) {
 return <ActionForm action={clonePublishedTier} submitLabel="내 비공개 티어표로 복사"><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><input type="hidden" name="token" value={token ?? ""}/><Checkbox name="confirm" required label="현재 게시된 배치를 내 비공개 초안으로 복사할게요. 제공할 수 없는 작품은 제외돼요."/><p className="field-hint">미배치 작품과 작성자의 개인 기록은 가져오지 않아요. 내 기본 평가도 바뀌지 않아요.</p></ActionForm>;
}
export function ReportTierForm({id,token}:{id:string;token:string|null}) {
 return <ActionForm action={reportTier} submitLabel="티어표 신고 접수"><input type="hidden" name="id" value={id}/><input type="hidden" name="token" value={token ?? ""}/><Select name="reason" label="신고 사유">{Object.entries(reportLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</Select><Textarea name="detail" label="확인이 필요한 내용 (10~2000자)" maxLength={4000}/><p className="field-hint">신고자와 상세 내용은 작성자에게 공개되지 않아요. 처리 중인 같은 티어표 신고는 중복 접수하지 않아요.</p></ActionForm>;
}
export function ModerateTierForm({snapshot}:{snapshot:TierModeration}) {
 return <ActionForm action={moderateTier} submitLabel="운영 조치 기록"><input type="hidden" name="id" value={snapshot.id}/><input type="hidden" name="version" value={snapshot.version}/><Select name="operation" label="조치">{!snapshot.deleted && snapshot.visibility !== "private" ? <><option value="hide">티어표 숨김 · 공유 링크 철회</option><option value="restore">숨김 해제 · 기존 공유 링크는 철회 유지</option></> : null}<option value="reject_report">선택한 신고 기각</option></Select><Select name="reportId" label="함께 처리할 신고"><option value="">신고 선택 안 함</option>{snapshot.reports.filter(r=>r.status === "pending").map(r=><option key={r.id} value={r.id}>{reportLabels[r.reason]} · {r.id}</option>)}</Select><Textarea name="reason" label="비공개 운영 사유 (2~1000자)" maxLength={2000}/><Textarea name="result" label="선택한 신고자에게 안내할 결과 (최대 500자)" maxLength={1000}/></ActionForm>;
}
