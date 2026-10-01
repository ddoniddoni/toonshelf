import { AdminShell } from "@/components/catalogue/admin-shell";
import { MergeForm } from "@/components/catalogue/merge-form";
import { getMergePreview,guardAdminPage } from "@/lib/catalogue/admin";
import { catalogueError } from "@/lib/catalogue/errors";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
export const metadata = {title:"작품 병합",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
  const account = await guardAdminPage("/admin/works/merge");const params = await searchParams;
  const source = typeof params.source === "string" ? uuidSchema.parse(params.source) : null;
  const target = typeof params.target === "string" ? uuidSchema.parse(params.target) : null;
  const result = account ? await account.client.from("works").select("id,title,age_rating").neq("catalogue_status","merged").eq("is_test",false).order("title").limit(200) : null;
  if(result)catalogueError(result.error);
  const preview = account && source && target ? await getMergePreview(source,target) : null;
  return <AdminShell title="같은 작품으로 모으기" description="미리보기와 근거 확인 후 공식 링크·작가·장르를 통합해요." connected={Boolean(account)}>
    <form method="get" className="account-form"><label>합쳐질 작품<select name="source" required defaultValue={source ?? ""}><option value="">선택</option>{result?.data?.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></label>
      <label>남길 작품<select name="target" required defaultValue={target ?? ""}><option value="">선택</option>{result?.data?.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></label><button className="button button-secondary">병합 결과 미리보기</button></form>
    {preview ? <section className="admin-form-section"><h2>{preview.source.title} → {preview.target.title}</h2><p>공식 링크 {preview.sourceLinkCount}개와 장르 {preview.sourceGenreCount}개를 통합해요. 남길 작품의 소개와 표지를 유지하고, 이전 제목은 별칭에 포함해요. 더 높은 비성인 등급을 적용해요.</p>
      <p>남길 작품의 상태는 {preview.target.status}이며 이를 유지해요. 이전 주소는 남길 작품이 공개 가능한 경우에만 이동해요. 성인·미확인 등급은 병합할 수 없어요.{preview.sourceCoverWillBeRevoked ? " 합쳐질 작품의 표지 허가는 철회돼요." : ""}</p>
      {preview.blockedByPersonalDomains ? <p role="alert">개인 기록 보존을 위한 병합 처리가 먼저 필요해 지금은 병합할 수 없어요.</p> : <MergeForm sourceId={preview.source.id} targetId={preview.target.id} sourceVersion={preview.source.version} targetVersion={preview.target.version}/>}
    </section> : null}
  </AdminShell>;
}
