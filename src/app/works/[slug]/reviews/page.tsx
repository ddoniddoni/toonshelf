import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkDetail } from "@/lib/catalogue/data";
import { listReviews } from "@/lib/reviews/data";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ReviewList } from "@/components/reviews/review-list";
export const dynamic = "force-dynamic";
export const metadata = {title:"작품 리뷰",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<SearchParams>}) {
 const work = await getWorkDetail((await params).slug);if(!work)notFound();let page:number;
 try{page = parsePage((await searchParams).page);}catch{return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href={"/works/"+work.slug+"/reviews"}>리뷰 목록으로 돌아가기</Link></section>;}
 const reviews = await listReviews(work.id,null,page);if(!reviews)notFound();
 return <section className="page-container review-detail"><Link className="text-link" href={"/works/"+work.slug}>← 작품 정보</Link><h1>{work.title} 리뷰 · {reviews.total}개</h1><p>최초 게시일 최신순이에요. 숨김·공개 취소·차단한 사용자의 리뷰는 제외돼요.</p><button className="button button-secondary" disabled>좋아요순 · 소셜 기능 준비 중</button><ReviewList items={reviews.items}/><nav className="library-pagination" aria-label="작품 리뷰 페이지">{page > 1 ? <Link href={"/works/"+work.slug+"/reviews?page="+(page-1)}>이전</Link> : null}{reviews.hasNext ? <Link href={"/works/"+work.slug+"/reviews?page="+(page+1)}>다음</Link> : null}</nav></section>;
}
