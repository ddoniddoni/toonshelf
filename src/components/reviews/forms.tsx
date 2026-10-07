"use client";
import { ActionForm,Checkbox,Field,Select,Textarea } from "@/components/forms/action-form";
import { createReview,saveReviewDraft,publishReview,withdrawReview,reportReview,setUserBlock,moderateReview } from "@/lib/reviews/actions";
import { publishPayloadSchema,reportLabels,type ReviewEditor,type ModerationSnapshot } from "@/lib/reviews/model";
import { ReviewText } from "./plain-text";
export function CreateReviewForm({workId}:{workId:string}) {
 return <ActionForm action={createReview} submitLabel="리뷰 작성 / 수정"><input name="workId" type="hidden" value={workId}/><p className="field-hint">내 현재 리뷰가 있으면 편집 화면으로 이동해요. 별점 없이도 작성할 수 있어요.</p></ActionForm>;
}
export function EditorForms({editor}:{editor:ReviewEditor}) {
 const publishable = publishPayloadSchema.safeParse(editor.draft).success && editor.moderationStatus === "visible" && editor.work !== null;
 const hidden = <><input type="hidden" name="id" value={editor.id}/><input type="hidden" name="reviewVersion" value={editor.reviewVersion}/></>;
 return <div className="review-editor-forms">{editor.work ? <section><h2>비공개 수정 초안</h2><p>초안을 저장해도 게시된 본문은 바뀌지 않아요. 먼저 초안을 저장한 뒤, 아래에서 저장한 초안을 게시해 주세요.</p>
  <ActionForm action={saveReviewDraft} submitLabel="비공개 초안 저장"><input type="hidden" name="id" value={editor.id}/><input type="hidden" name="draftVersion" value={editor.draftVersion}/><Textarea name="body" label="리뷰 본문 (최대 5000자, 게시할 때 20자 이상)" defaultValue={editor.draft.body} maxLength={10000}/><Checkbox name="isSpoiler" defaultChecked={editor.draft.isSpoiler} label="작품 전개를 알 수 있는 스포일러가 포함돼요"/><Field name="episode" type="number" min={0} max={1000000} step={1} label="리뷰에서 공개할 읽은 기준 회차 (선택)" defaultValue={editor.draft.episode ?? ""} hint="개인 서재의 비공개 회차를 자동으로 가져오지 않아요. 입력하면 리뷰에 공개돼요."/></ActionForm>
  <p className="field-hint">초안 저장: {new Date(editor.draftUpdatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} (한국 시간). HTML과 임베드는 실행하지 않아요.</p>
  </section> : <section><h2>현재 제공할 수 없는 작품의 초안</h2><p>새 저장·게시가 제한돼요. 기존 초안을 확인하고 리뷰를 삭제하거나 공개를 취소할 수 있어요.</p><ReviewText body={editor.draft.body}/></section>}
  <section className="review-publish-panel"><h2>저장된 초안 게시</h2><p>아래 내용은 마지막으로 서버에 저장한 초안이에요. 위 입력란에서 아직 저장하지 않은 변경은 게시되지 않아요.</p><details><summary>저장된 초안 미리보기 · {editor.draft.isSpoiler ? "스포일러 포함" : "스포일러 미표시"}</summary><ReviewText body={editor.draft.body}/><p>공개 기준 회차: {editor.draft.episode ?? "미지정"}</p></details>
   {publishable ? <ActionForm action={publishReview} submitLabel={editor.publicationStatus === "published" ? "게시본 업데이트" : "리뷰 공개 게시"}>{hidden}<input type="hidden" name="draftVersion" value={editor.draftVersion}/><Checkbox name="confirm" required label="저장된 초안과 스포일러·공개 회차를 확인했으며 게시에 동의해요"/></ActionForm> : <p className="reading-warning">{editor.moderationStatus === "hidden" ? "운영자가 숨긴 리뷰예요. 직접 재게시할 수 없어요." : "게시하려면 제공 가능한 작품에 20자 이상의 초안을 저장해 주세요."}</p>}
  </section>
  {editor.publicationStatus === "published" ? <details><summary>내 현재 게시본 확인</summary><ReviewText body={editor.publishedBody}/><ActionForm action={withdrawReview} submitLabel="리뷰 공개 취소">{hidden}<input type="hidden" name="operation" value="unpublish"/><Checkbox name="confirm" required label="공개를 취소할게요. 초안과 내 게시본 기록은 유지돼요."/></ActionForm></details> : null}
  <details className="library-privacy-panel"><summary>리뷰 삭제</summary><ActionForm action={withdrawReview} submitLabel="리뷰와 수정 초안 삭제">{hidden}<input type="hidden" name="operation" value="delete"/><Checkbox name="confirm" required label="리뷰 본문과 초안을 삭제할게요. 내 서재·별점·기본 티어는 유지돼요."/></ActionForm></details>
 </div>;
}
export function ReportReviewForm({id}:{id:string}) {
 return <ActionForm action={reportReview} submitLabel="리뷰 신고 접수"><input type="hidden" name="reviewId" value={id}/><Select name="reason" label="신고 사유">{Object.entries(reportLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select><Textarea name="detail" label="확인이 필요한 내용 (10~2000자)" maxLength={4000}/><p className="field-hint">비밀번호·연락처 등 불필요한 개인정보를 적지 마세요. 신고자와 상세 내용은 작성자에게 공개하지 않아요. 동일 리뷰의 처리 중 신고는 중복 접수하지 않아요.</p></ActionForm>;
}
export function BlockForm({userId,blocked=false,name}:{userId:string;blocked?:boolean;name:string}) {
 return <ActionForm action={setUserBlock} submitLabel={blocked ? "차단 해제" : "사용자 차단"}><input type="hidden" name="userId" value={userId}/><input type="hidden" name="blocked" value={String(!blocked)}/><Checkbox name="confirm" required label={blocked ? `${name}의 차단을 해제할게요. 이전 팔로우는 복원되지 않아요.` : `${name}을 차단하고 양쪽 팔로우를 해제하며 서로의 리뷰·프로필·공개 기록 노출을 제한할게요`}/></ActionForm>;
}
export function ModerationForm({snapshot}:{snapshot:ModerationSnapshot}) {
 return <ActionForm action={moderateReview} submitLabel="운영 조치 기록"><input type="hidden" name="reviewId" value={snapshot.id}/><input type="hidden" name="reviewVersion" value={snapshot.version}/><Select name="operation" label="조치">{!snapshot.deleted && snapshot.publicationStatus === "published" ? <><option value="hide">리뷰 숨김</option><option value="restore">리뷰 숨김 해제</option></> : null}<option value="reject_report">선택한 신고 기각</option></Select><Select name="reportId" label="함께 처리할 신고 (선택)"><option value="">신고 선택 안 함</option>{snapshot.reports.filter(r=>r.status === "pending").map(r=><option key={r.id} value={r.id}>{reportLabels[r.reason]} · {r.id}</option>)}</Select><Textarea name="reason" label="비공개 운영 사유 (2~1000자)" maxLength={2000}/><Textarea name="result" label="선택한 신고자에게 안내할 결과 (최대 500자)" maxLength={1000}/><p className="field-hint">사유·대상 버전·신고 결과를 함께 저장해요. 역할 부여나 계정 승격은 이 화면에서 할 수 없어요.</p></ActionForm>;
}
