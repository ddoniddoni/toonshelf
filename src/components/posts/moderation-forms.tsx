"use client";
import { ActionForm,Select,Textarea } from "@/components/forms/action-form";
import { reportPost,moderatePost } from "@/lib/posts/actions";
import { reportLabels } from "@/lib/reviews/model";
import type { PostModeration } from "@/lib/posts/model";
export function ReportPostForm({id}:{id:string}) {
 return <ActionForm action={reportPost} submitLabel="글 신고 접수"><input type="hidden" name="postId" value={id}/><Select name="reason" label="신고 사유">{Object.entries(reportLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select><Textarea name="detail" label="확인이 필요한 내용 (10~2000자)" maxLength={4000}/><p className="field-hint">비밀번호·연락처 등 불필요한 개인정보를 적지 마세요. 신고자와 상세 내용은 작성자에게 공개하지 않아요. 동일 글의 처리 중 신고는 중복 접수하지 않아요.</p></ActionForm>;
}
export function ModerationForm({snapshot}:{snapshot:PostModeration}) {
 return <ActionForm action={moderatePost} submitLabel="운영 조치 기록"><input type="hidden" name="postId" value={snapshot.id}/><input type="hidden" name="postVersion" value={snapshot.version}/><Select name="operation" label="조치">{!snapshot.deleted && snapshot.publicationStatus === "published" ? <><option value="hide">글 숨김</option><option value="restore">글 숨김 해제</option></> : null}<option value="reject_report">선택한 신고 기각</option></Select><Select name="reportId" label="함께 처리할 신고 (선택)"><option value="">신고 선택 안 함</option>{snapshot.reports.filter(r=>r.status === "pending").map(r=><option key={r.id} value={r.id}>{reportLabels[r.reason]} · {r.id}</option>)}</Select><Textarea name="reason" label="비공개 운영 사유 (2~1000자)" maxLength={2000}/><Textarea name="result" label="선택한 신고자에게 안내할 결과 (최대 500자)" maxLength={1000}/><p className="field-hint">사유·대상 버전·신고 결과를 함께 저장해요. 역할 부여나 계정 승격은 이 화면에서 할 수 없어요.</p></ActionForm>;
}
