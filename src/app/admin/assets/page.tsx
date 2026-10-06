import { AdminShell } from "@/components/catalogue/admin-shell";
import { RevokeCoverForm,UploadCoverForm } from "@/components/catalogue/asset-forms";
import { getAdminSnapshot,guardAdminPage } from "@/lib/catalogue/admin";
import { catalogueError } from "@/lib/catalogue/errors";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
export const metadata = {title:"표지 권리 관리",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
  const account = await guardAdminPage("/admin/assets");const params = await searchParams;
  const result = account ? await account.client.from("toon_works").select("id,title").neq("catalogue_status","merged").eq("is_test",false).order("updated_at",{ascending:false}).limit(200) : null;
  if(result)catalogueError(result.error);
  const selected = typeof params.work === "string" ? uuidSchema.parse(params.work) : result?.data?.[0]?.id;
  const snapshot = account && selected ? await getAdminSnapshot(selected) : null;
  const works = [...(result?.data ?? [])];
  if(snapshot && !works.some(w=>w.id === snapshot.work.id))works.push({id:snapshot.work.id,title:snapshot.work.title});
  return <AdminShell title="표지와 사용 허가" description="허가가 없거나 만료·철회되면 텍스트 표지를 사용해요. 원본 파일은 공개 bucket에 두지 않아요." connected={Boolean(account)}>
    {works.length ? <><form method="get" className="admin-toolbar"><label>권리 기록을 볼 작품<select name="work" defaultValue={selected}>{works.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></label><button className="button button-secondary">기록 보기</button></form>
      <section className="admin-form-section"><h2>허가된 표지 등록</h2><UploadCoverForm key={selected} works={works} selected={selected}/></section>
      <section className="admin-form-section"><h2>권리 기록</h2>{snapshot?.assets.length ? snapshot.assets.map(a=><article className="asset-record" key={a.id}><h3>{a.rights_holder} · {a.status}</h3><p>화면 {a.display_allowed ? "허용" : "불가"} / OG {a.og_allowed ? "허용" : "불가"} / PNG {a.export_allowed ? "허용" : "불가"} / 상업적 이용 {a.commercial_allowed ? "허용" : "불가"}</p>
        <p>허가: {a.valid_from} ~ {a.expires_at ?? "만료일 없음"}</p><p>공개 표기: {a.attribution || "없음"}</p><details><summary>비공개 허가 근거</summary><p>{a.evidence_reference}</p></details>
        {a.status !== "revoked" ? <RevokeCoverForm assetId={a.id}/> : null}
      </article>) : <p>등록된 표지 권리 기록이 없어요.</p>}</section>
    </> : <p>실제 작품을 먼저 등록해 주세요. 테스트 작품에는 표지를 등록하지 않아요.</p>}
  </AdminShell>;
}
