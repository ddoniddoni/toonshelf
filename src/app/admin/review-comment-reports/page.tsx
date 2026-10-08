import { withReviewAvailability } from "@/lib/reviews/availability";
import { ReviewAvailabilityNotice } from "@/components/reviews/availability-notice";
import Link from "next/link";
import { guardModeratorPage } from "@/lib/reviews/moderation";
import { listCommentReports } from "@/lib/review-comments/data";
import { parsePage } from "@/lib/library/model";
import { reportLabels } from "@/lib/reviews/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"리뷰 댓글 신고 관리",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account=await guardModeratorPage("/admin/review-comment-reports");if (!account) return <section className="page-container review-detail"><h1>리뷰 댓글 신고 관리</h1><ConnectionNotice/></section>;
 let page:number;try {page=parsePage((await searchParams).page);} catch {return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href="/admin/review-comment-reports">첫 페이지로 돌아가기</Link></section>;}
 const loaded=await withReviewAvailability(()=>listCommentReports(page));
 if(!loaded.available)return <section className="page-container review-detail"><h1>리뷰 댓글 신고 관리</h1><ReviewAvailabilityNotice href="/admin/reports"/></section>;
 const queue=loaded.value;
 return <section className="page-container review-detail"><Link className="text-link" href="/admin/reports">리뷰 신고 관리 →</Link><h1>처리 대기 댓글 신고</h1><p>신고만으로 자동 제재하지 않아요. 현재 공개 범위와 사유를 확인한 뒤 조치해 주세요. 원문은 별도 검토 화면에서 펼쳐요.</p><div className="review-list">{queue.items.map(r=><article className="review-card" key={r.id}><h2>{reportLabels[r.reason]}</h2><p className="private-note">{r.detail}</p><Link href={`/admin/review-comments/${r.commentId}`} prefetch={false} className="text-link">댓글·신고 검토 →</Link></article>)}</div>{!queue.items.length ? <p>이 페이지에 처리 대기 신고가 없어요.</p> : null}<nav className="library-pagination" aria-label="댓글 신고 페이지">{page > 1 ? <Link href={`/admin/review-comment-reports?page=${page-1}`} prefetch={false}>이전</Link> : null}{queue.hasNext && page < 1000 ? <Link href={`/admin/review-comment-reports?page=${page+1}`} prefetch={false}>다음</Link> : null}</nav></section>;
}
