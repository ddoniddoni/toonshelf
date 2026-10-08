import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkDetail } from "@/lib/catalogue/data";
import { listReviews } from "@/lib/reviews/data";
import { reviewSortSchema,type ReviewSort } from "@/lib/reviews/model";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ReviewList } from "@/components/reviews/review-list";
import { ReviewSortControl,reviewListUrl } from "@/components/reviews/sort-control";
export const dynamic="force-dynamic";
export const metadata={title:"공개 리뷰",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<SearchParams>}) {
 const work=await getWorkDetail((await params).slug);if(!work)notFound();const base=`/works/${work.slug}/reviews`;
 const query=await searchParams;let page:number;let sort:ReviewSort;
 try {page=parsePage(query.page);sort=reviewSortSchema.parse(query.sort ?? "latest");}
 catch {return <section className="page-container"><p role="alert">정렬과 페이지 번호를 확인해 주세요.</p><Link href={base}>리뷰 목록으로 돌아가기</Link></section>;}
 const reviews=await listReviews(work.id,null,page,sort);if(!reviews)notFound();
 return <section className="page-container review-detail"><Link className="text-link" href={"/works/"+work.slug}>← 작품 정보</Link><h1>{work.title} 리뷰 · {reviews.total}개</h1>
  <ReviewSortControl base={base} sort={reviews.sort} available={reviews.engagementAvailable}/><ReviewList items={reviews.items}/>
  <nav className="library-pagination" aria-label="리뷰 페이지">{page>1 ? <Link href={reviewListUrl(base,reviews.sort,page-1)} prefetch={false}>이전</Link> : null}{reviews.hasNext && page<1000 ? <Link href={reviewListUrl(base,reviews.sort,page+1)} prefetch={false}>다음</Link> : null}</nav>
 </section>;
}
