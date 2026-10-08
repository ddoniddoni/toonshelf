import Link from "next/link";
import { guardModeratorPage,listReviewReports } from "@/lib/reviews/moderation";
import { parsePage } from "@/lib/library/model";
import { reportLabels } from "@/lib/reviews/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic = "force-dynamic";
export const metadata = {title:"리뷰 신고 관리",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account = await guardModeratorPage("/admin/reports");if(!account)return <section className="page-container review-detail"><h1>리뷰 신고 관리</h1><ConnectionNotice/></section>;
 let page:number;try{page = parsePage((await searchParams).page);}catch{return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href="/admin/reports">신고 목록으로 돌아가기</Link></section>;}
 const queue = await listReviewReports(page);
 return <section className="page-container review-detail"><p className="eyebrow">콘텐츠 운영</p><h1>처리 대기 리뷰 신고</h1><Link className="text-link" href="/admin/post-reports">커뮤니티 글 신고 →</Link><Link className="text-link" href="/admin/tier-reports">티어표 신고 관리 →</Link><p>접수 자체로 자동 제재하지 않아요. 현재 게시본과 사유를 확인한 뒤 조치해 주세요.</p><div className="review-list">{queue.items.map(r=><article className="review-card" key={r.id}><h2>{reportLabels[r.reason]}</h2><p className="private-note">{r.detail}</p><Link className="text-link" href={"/admin/reviews/"+r.review_id}>리뷰·신고 검토 →</Link></article>)}</div>{!queue.items.length ? <p>이 페이지에 처리 대기 신고가 없어요.</p> : null}<nav className="library-pagination" aria-label="운영 신고 페이지">{page > 1 ? <Link href={"/admin/reports?page="+(page-1)}>이전</Link> : null}{queue.hasNext ? <Link href={"/admin/reports?page="+(page+1)}>다음</Link> : null}</nav></section>;
}
