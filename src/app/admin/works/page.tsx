import Link from "next/link";
import { z } from "zod";
import { AdminShell } from "@/components/catalogue/admin-shell";
import { guardAdminPage } from "@/lib/catalogue/admin";
import { catalogueError } from "@/lib/catalogue/errors";
import { canonicalOfficialUrl,platformSchema,uuidSchema,type SearchParams } from "@/lib/catalogue/model";
const duplicateSchema = z.array(z.object({id:uuidSchema,title:z.string(),catalogue_status:z.string()}));
const literalLike = (value:string)=>"%"+value.replace(/[\\%_]/g,c=>"\\"+c)+"%";
export const metadata = {title:"작품 관리",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
  const account = await guardAdminPage("/admin/works");
  const params = await searchParams;const q = z.string().max(200).parse(typeof params.q === "string" ? params.q.trim() : "");
  const status = z.enum(["draft","published","hidden","merged"]).optional().parse(typeof params.status === "string" && params.status ? params.status : undefined);
  let works:{id:string;title:string;catalogue_status:string;age_rating:string;is_test:boolean;version:number}[] = [];
  let duplicates:z.infer<typeof duplicateSchema> = [];
  if (account) {
    let query = account.client.from("works").select("id,title,catalogue_status,age_rating,is_test,version").order("updated_at",{ascending:false}).order("id").limit(50);
    if(q)query = query.ilike("title",literalLike(q));if(status)query = query.eq("catalogue_status",status);
    const result = await query;catalogueError(result.error);works = result.data ?? [];
    if (typeof params.duplicateTitle === "string" || typeof params.duplicateUrl === "string") {
      const title = z.string().max(200).parse(typeof params.duplicateTitle === "string" ? params.duplicateTitle.trim() : "");
      const urls:string[] = [];
      if (typeof params.duplicateUrl === "string" && params.duplicateUrl.trim()) {
        const raw = z.string().max(2048).parse(params.duplicateUrl);const platforms = await account.client.from("platforms").select("*").eq("active",true);catalogueError(platforms.error);
        const host = new URL(raw).hostname;const platform = z.array(platformSchema).parse(platforms.data).find(p=>p.approved_hosts.includes(host));
        if (!platform) throw new Error("INVALID_OFFICIAL_URL");urls.push(canonicalOfficialUrl(raw,platform));
      }
      const result = await account.client.rpc("admin_find_duplicates",{p_title:title,p_urls:urls});catalogueError(result.error);duplicates = duplicateSchema.parse(result.data);
    }
  }
  return <AdminShell title="작품 관리" description="최근 수정한 50개 작품을 표시해요. 제목이나 상태로 좁혀 찾아보세요." connected={Boolean(account)}>
    <div className="admin-toolbar"><form method="get"><label>제목<input name="q" defaultValue={q} maxLength={200}/></label><label>상태<select name="status" defaultValue={status ?? ""}><option value="">전체</option><option value="draft">검수 중</option><option value="published">공개</option><option value="hidden">숨김</option><option value="merged">병합됨</option></select></label><button className="button button-secondary">찾기</button></form><Link className="button button-primary" href="/admin/works/new">작품 등록</Link></div>
    <details className="admin-form-section"><summary>등록 전 중복 확인</summary><form method="get" className="account-form"><label>정확한 제목 또는 별칭<input name="duplicateTitle" maxLength={200}/></label><label>공식 링크 · 선택<input name="duplicateUrl" type="url" maxLength={2048}/></label><button className="button button-secondary">중복 후보 찾기</button></form><p className="field-hint">같은 제목도 원작·리메이크가 다를 수 있어요. 링크·플랫폼 식별자의 실제 중복은 저장 시에도 차단돼요.</p>
      {duplicates.map(w=><p key={w.id}><Link className="text-link" href={"/admin/works/"+w.id+"/edit"}>{w.title} · {w.catalogue_status}</Link></p>)}{(params.duplicateTitle || params.duplicateUrl) && !duplicates.length ? <p>해당 제목·링크의 중복 후보가 없어요.</p> : null}
    </details>
    <div className="admin-work-list">{works.length ? works.map(w=><article key={w.id}><div><h2><Link href={"/admin/works/"+w.id+"/edit"}>{w.title}</Link></h2><p>{w.catalogue_status} · {w.age_rating} · 수정 버전 {w.version}{w.is_test ? " · 로컬 테스트용" : ""}</p></div><Link className="text-link" href={"/admin/works/"+w.id+"/edit"}>수정</Link></article>) : <p>등록된 작품이 없거나 검색 조건에 맞는 작품이 없어요.</p>}</div>
  </AdminShell>;
}
