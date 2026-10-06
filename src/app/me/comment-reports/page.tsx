import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { listCommentReports } from "@/lib/comments/data";
import { parsePage } from "@/lib/library/model";
import { reportLabels } from "@/lib/reviews/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"내 티어표 댓글 신고 접수",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account=await guardPage("/me/comment-reports");if (!account) return <section className="page-container review-detail"><h1>내 티어표 댓글 신고 접수</h1><ConnectionNotice/></section>;
 let page:number;try {page=parsePage((await searchParams).page);} catch {return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href="/me/comment-reports">첫 페이지로 돌아가기</Link></section>;}
 const reports=await listCommentReports(page,true);
 return <section className="page-container review-detail"><Link className="text-link" href="/me/tier-reports">내 티어표 신고 접수 →</Link><h1>내 댓글 신고 접수</h1><p>내가 접수한 티어표 댓글 신고와 처리 결과만 보여요.</p><div className="review-list">{reports.items.map(r=><article key={r.id} className="review-card"><h2>{reportLabels[r.reason]}</h2><p>{r.status === "pending" ? "처리 대기" : r.status === "resolved" ? "처리 완료" : "기각"}</p><p className="private-note">{r.detail}</p><p>{r.result || "아직 처리 안내가 없어요."}</p></article>)}</div>{!reports.items.length ? <p>이 페이지에 접수한 신고가 없어요.</p> : null}<nav className="library-pagination" aria-label="내 댓글 신고 페이지">{page > 1 ? <Link href={`/me/comment-reports?page=${page-1}`} prefetch={false}>이전</Link> : null}{reports.hasNext && page < 1000 ? <Link href={`/me/comment-reports?page=${page+1}`} prefetch={false}>다음</Link> : null}</nav></section>;
}
