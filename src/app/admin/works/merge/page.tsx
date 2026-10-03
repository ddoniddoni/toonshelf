import { AdminShell } from "@/components/catalogue/admin-shell";
import { MergeForm } from "@/components/catalogue/merge-form";
import { getMergePreview,guardAdminPage } from "@/lib/catalogue/admin";
import { catalogueError } from "@/lib/catalogue/errors";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { AuthFailure } from "@/lib/auth/errors";
const conflictLabels = {notes:"메모의 상한 초과",tags:"태그의 상한 초과",plannedEvaluations:"나중에 볼 상태와 평가 충돌",dates:"읽기 시작·종료일 충돌",reviews:"같은 회원의 현재 리뷰 중복",unavailable:"공개할 수 없는 원본 작품의 개인 기록",metadata:"작품 별칭·관계의 상한 초과"} as const;
const parseId = (value:unknown)=>{const parsed = uuidSchema.safeParse(value);return parsed.success ? parsed.data : null;};
export const metadata = {title:"작품 병합",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
  const account = await guardAdminPage("/admin/works/merge");const params = await searchParams;
  const source = parseId(params.source);
  const target = parseId(params.target);
  let previewError:string|null = params.source && !source || params.target && !target ? "두 작품을 올바르게 선택해 주세요." : null;
  const result = account ? await account.client.from("works").select("id,title,age_rating").neq("catalogue_status","merged").eq("is_test",false).order("title").limit(200) : null;
  if(result)catalogueError(result.error);
  let preview:Awaited<ReturnType<typeof getMergePreview>>|null = null;
  if (account && source && target) {
    if (source === target) previewError = "서로 다른 두 작품을 선택해 주세요.";
    else try { preview = await getMergePreview(source,target); }
    catch (error) { previewError = error instanceof AuthFailure ? error.message : "병합 미리보기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."; }
  }
  return <AdminShell title="같은 작품으로 모으기" description="미리보기와 근거 확인 후 공식 링크·작가·장르를 통합해요." connected={Boolean(account)}>
    <form method="get" className="account-form"><label>합쳐질 작품<select name="source" required defaultValue={source ?? ""}><option value="">선택</option>{result?.data?.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></label>
      <label>남길 작품<select name="target" required defaultValue={target ?? ""}><option value="">선택</option>{result?.data?.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></label><button className="button button-secondary">병합 결과 미리보기</button></form>
    {previewError ? <p role="alert">{previewError}</p> : null}
    {preview ? <section className="admin-form-section"><h2>{preview.source.title} → {preview.target.title}</h2><p>공식 링크 {preview.sourceLinkCount}개와 장르 {preview.sourceGenreCount}개를 통합해요. 남길 작품의 소개와 표지를 유지하고, 이전 제목은 별칭에 포함해요. 더 높은 비성인 등급을 적용해요.</p>
      <p>남길 작품의 상태는 {preview.target.status}이며 이를 유지해요. 이전 주소는 남길 작품이 공개 가능한 경우에만 이동해요. 성인·미확인 등급은 병합할 수 없어요.{preview.sourceCoverWillBeRevoked ? " 합쳐질 작품의 표지 허가는 철회돼요." : ""}</p>
      <h3>개인 기록 보존</h3><p>서재 {preview.records.library}건(두 작품에 겹친 기록 {preview.records.overlappingLibrary}건), 평가 {preview.records.evaluations}건, 현재 리뷰 {preview.records.reviews}건, 편집 초안 {preview.records.drafts}건을 옮겨요. 메모·태그 원문과 회원별 기록은 이 화면에서 제공하지 않아요.</p>
      <p>상태·평가·진행 기록은 각각 최신 값을 선택하고, 같은 시각이면 남길 작품을 선택해요. 비어 있는 진행 값은 다른 기록에서 보완해요. 서재와 평가 공개 범위는 각각 더 제한적인 쪽을 유지해요. 메모에는 원래 작품을 구분해 표시하고 태그는 중복 없이 합쳐요. 원래 기록은 본인만 볼 수 있는 병합 이력에 남아요.</p>
      <p>현재 리뷰가 겹치면 자동 삭제하지 않아요. 겹치지 않는 리뷰는 주소·게시/스포일러/운영 상태와 신고를 유지하고 편집 초안을 함께 옮겨요. 미리보기는 10분 동안 유효하며 기록이 변경되면 다시 확인해야 해요.</p>
      {!preview.canMerge ? <div role="alert"><p>충돌이 있어 병합할 수 없어요.</p><ul>{Object.entries(preview.conflicts).filter(([,count])=>count > 0).map(([key,count])=><li key={key}>{conflictLabels[key as keyof typeof conflictLabels]}: {count}건</li>)}</ul>
        {preview.blockedByPersonalDomains ? <p>추가된 티어·게시글 도메인의 보존 처리가 먼저 필요해요.</p> : null}
        <p>개인 내용은 소유자가 자신의 기록·리뷰 화면에서 별도로 보관한 뒤 편집·삭제해 충돌을 정리해야 해요. 숨긴 원본 작품은 공개 조건을 먼저 검토해 주세요. 처리 후 미리보기를 다시 요청해 주세요.</p></div>
        : <MergeForm key={preview.previewToken} sourceId={preview.source.id} targetId={preview.target.id} sourceVersion={preview.source.version} targetVersion={preview.target.version} previewToken={preview.previewToken}/>}
    </section> : null}
  </AdminShell>;
}
