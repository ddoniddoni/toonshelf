import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/catalogue/admin-shell";
import { WorkForm } from "@/components/catalogue/work-form";
import { getAdminSnapshot,guardAdminPage } from "@/lib/catalogue/admin";
import { catalogueOptions } from "@/lib/catalogue/data";
import { catalogueError } from "@/lib/catalogue/errors";
import { uuidSchema } from "@/lib/catalogue/model";
export const metadata = {title:"작품 수정",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;if(!uuidSchema.safeParse(id).success)notFound();
  const account = await guardAdminPage("/admin/works/"+id+"/edit");
  const [snapshot,options,creators] = account ? await Promise.all([getAdminSnapshot(id),catalogueOptions(),account.client.from("toon_creators").select("*").order("name").limit(200)]) : [null,null,null];
  if(account && !snapshot)notFound();if(creators)catalogueError(creators.error);
  const known = [...(creators?.data ?? [])];
  for(const creator of snapshot?.creators ?? [])if(creator.id && !known.some(c=>c.id === creator.id))known.push({id:creator.id,name:creator.name,aliases:creator.aliases});
  return <AdminShell title={snapshot?.work.title ?? "작품 수정"} description="다른 관리자가 먼저 수정하면 저장을 멈추고 최신 정보를 확인하게 해요." connected={Boolean(account)}>
    {snapshot && options ? <><div className="admin-toolbar"><Link className="text-link" href={"/works/"+snapshot.work.slug}>공개 상세</Link><Link className="text-link" href={"/admin/assets?work="+id}>표지 권리</Link><Link className="text-link" href={"/admin/works/merge?source="+id}>다른 작품으로 병합</Link></div>
      {snapshot.work.catalogue_status === "merged" ? <p>이미 병합된 작품은 수정할 수 없어요.</p> : <WorkForm key={snapshot.work.version} snapshot={snapshot} platforms={options.platforms} genres={options.genres} knownCreators={known}/>}
      <details className="admin-form-section"><summary>정보 출처 기록</summary>{snapshot.sources.map((s,i)=><article key={i}><p>{s.source_url}</p><p>{s.verified_at} · {s.verified_fields.join(" · ")}</p><p>{s.note}</p></article>)}</details>
    </> : null}
  </AdminShell>;
}
