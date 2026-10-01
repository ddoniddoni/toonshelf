import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { catalogueError } from "@/lib/catalogue/errors";
import { EmptyState } from "@/components/ui/empty-state";
export const metadata = {title:"내 작품 제보",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
const labels = {pending:"검수 대기",accepted:"반영",rejected:"미반영"} as const;
export default async function Page() {
  const account = await guardPage("/submissions");
  const result = account ? await account.client.from("catalogue_submissions").select("id,kind,proposal,status,result_note,reviewed_at,created_at").eq("user_id",account.user.id).order("created_at",{ascending:false}).order("id").limit(50) : null;
  if(result)catalogueError(result.error);
  return <div className="page-container submission-page"><header className="catalogue-heading"><div><p className="eyebrow">함께 채운 작품 정보</p><h1>내 제보와 처리 결과</h1><p>최근 50개 제보의 검수 상태와 결과를 확인해요.</p></div><Link className="button button-secondary" href="/submissions/new">새 작품 제보</Link></header>
    {!account ? <EmptyState title="제보 기록을 준비하고 있어요" description="계정 연결이 완료되면 본인의 제보와 처리 결과를 볼 수 있어요."/> : result?.data?.length ? <div className="submission-list">{result.data.map(s=><article key={s.id}><span className="work-status">{labels[s.status]}</span><p className="submission-proposal">{s.proposal}</p><p>{new Date(s.created_at).toLocaleDateString("ko-KR",{timeZone:"UTC"})}</p>{s.result_note ? <div className="submission-result"><strong>검수 결과</strong><p>{s.result_note}</p></div> : null}</article>)}</div> : <EmptyState title="아직 보낸 제보가 없어요" description="카탈로그에 빠진 작품이나 수정할 정보를 발견하면 알려 주세요."/>}
  </div>;
}
