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
  const result = account ? await account.client.from("toon_works").select("id,title,age_rating").neq("catalogue_status","merged").eq("is_test",false).order("title").limit(200) : null;
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
      <h3>개인 기록 보존</h3><p>서재 {preview.records.library}건(두 작품에 겹친 기록 {preview.records.overlappingLibrary}건), 평가 {preview.records.evaluations}건, 현재 리뷰 {preview.records.reviews}건, 리뷰 편집 초안 {preview.records.drafts}건, 비공개 티어 초안 {preview.records.tiers}건을 옮겨요. 메모·태그 원문과 회원별 기록은 이 화면에서 제공하지 않아요.</p>
      <p>상태·평가·진행 기록은 각각 최신 값을 선택하고, 같은 시각이면 남길 작품을 선택해요. 비어 있는 진행 값은 다른 기록에서 보완해요. 서재와 평가 공개 범위는 각각 더 제한적인 쪽을 유지해요. 메모에는 원래 작품을 구분해 표시하고 태그는 중복 없이 합쳐요. 원래 기록은 본인만 볼 수 있는 병합 이력에 남아요. 티어표에 두 작품이 있으면 기존 대상 배치를 유지하며 원래 배치는 소유자 전용 이력에 보관해요.</p>
      <p>현재 리뷰가 겹치면 자동 삭제하지 않아요. 겹치지 않는 리뷰는 주소·게시/스포일러/운영 상태와 신고를 유지하고 편집 초안을 함께 옮겨요. 미리보기는 10분 동안 유효하며 기록이 변경되면 다시 확인해야 해요.</p>
      <h3>커뮤니티 작품 연결</h3>{preview.community ? <><p>게시본의 작품 연결 {preview.community.posts}건, 편집 초안의 작품 연결 {preview.community.drafts}건을 옮겨요. 두 작품이 함께 연결된 게시본 {preview.community.deduplicatedPosts}건과 초안 {preview.community.deduplicatedDrafts}건은 먼저 나온 위치에 하나만 남겨요.</p><p>글 본문·공개 여부·스포일러 표시·댓글·좋아요·최초 게시일은 유지해요. 초안의 연결 변경은 초안에만 저장하며 자동으로 게시하지 않아요. 변경 전후의 작품 연결 이력은 작성자만 볼 수 있어요.</p></> : <p>커뮤니티 작품 연결 보존 기능을 준비하고 있어요. 이 화면에서는 글·초안의 연결 건수를 아직 제공하지 않아요.</p>}
      {!preview.canMerge ? <div role="alert"><p>충돌이 있어 병합할 수 없어요.</p><ul>{Object.entries(preview.conflicts).filter(([,count])=>count > 0).map(([key,count])=><li key={key}>{conflictLabels[key as keyof typeof conflictLabels]}: {count}건</li>)}</ul>
        {preview.blockedByPersonalDomains ? <p>아직 지원하지 않는 연결 데이터가 있어 보존 처리를 먼저 준비해야 해요.</p> : null}
        <p>개인 내용은 소유자가 자신의 기록·리뷰 화면에서 별도로 보관한 뒤 편집·삭제해 충돌을 정리해야 해요. 숨긴 원본 작품은 공개 조건을 먼저 검토해 주세요. 처리 후 미리보기를 다시 요청해 주세요.</p></div>
        : <MergeForm key={preview.previewToken} sourceId={preview.source.id} targetId={preview.target.id} sourceVersion={preview.source.version} targetVersion={preview.target.version} previewToken={preview.previewToken}/>}
    </section> : null}
  </AdminShell>;
}
