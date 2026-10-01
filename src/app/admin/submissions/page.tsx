import Link from "next/link";
import { AdminShell } from "@/components/catalogue/admin-shell";
import { ReviewForm } from "@/components/catalogue/suggestion-form";
import { guardAdminPage } from "@/lib/catalogue/admin";
import { catalogueError } from "@/lib/catalogue/errors";
export const metadata = {title:"작품 제보 검수",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await guardAdminPage("/admin/submissions");
  const [submissions,works] = account ? await Promise.all([
    account.client.from("catalogue_submissions").select("id,kind,work_id,proposal,source_url,created_at").eq("status","pending").order("created_at").order("id").limit(30),
    account.client.from("works").select("id,title").eq("catalogue_status","published").in("age_rating",["all","12","15"]).eq("is_test",false).order("title").limit(200)
  ]) : [null,null];
  if(submissions)catalogueError(submissions.error);if(works)catalogueError(works.error);
  return <AdminShell title="작품 제보 검수" description="접수 순서대로 30개를 표시해요. 출처를 확인하고 반영 여부와 결과를 제보자에게 남겨 주세요." connected={Boolean(account)}>
    {submissions?.data?.length ? <div className="submission-list">{submissions.data.map(s=><article key={s.id}><p className="work-status">{s.kind} · {new Date(s.created_at).toLocaleDateString("ko-KR",{timeZone:"UTC"})}</p>
      <p className="submission-proposal">{s.proposal}</p><a className="text-link" href={s.source_url} target="_blank" rel="noopener noreferrer">제보 출처 확인 ↗</a>
      <div>{s.work_id ? <Link className="text-link" href={"/admin/works/"+s.work_id+"/edit"}>대상 작품 수정</Link> : <Link className="text-link" href="/admin/works/new">새 작품 등록</Link>}</div>
      <ReviewForm id={s.id} works={works?.data ?? []}/>
    </article>)}</div> : <p>현재 검수를 기다리는 제보가 없어요.</p>}
  </AdminShell>;
}
