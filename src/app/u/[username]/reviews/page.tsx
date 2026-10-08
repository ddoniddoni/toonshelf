import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicEnv } from "@/lib/env/public";
import { usernameSchema } from "@/lib/auth/validation";
import { listReviews } from "@/lib/reviews/data";
import { reviewSortSchema,type ReviewSort } from "@/lib/reviews/model";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ReviewList } from "@/components/reviews/review-list";
import { ReviewSortControl,reviewListUrl } from "@/components/reviews/sort-control";
export const dynamic="force-dynamic";
export const metadata={title:"공개 리뷰",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{username:string}>;searchParams:Promise<SearchParams>}) {
 const {username}=await params;if(!getPublicEnv().supabase || !usernameSchema.safeParse(username).success)notFound();const base=`/u/${username}/reviews`;
 const query=await searchParams;let page:number;let sort:ReviewSort;
 try {page=parsePage(query.page);sort=reviewSortSchema.parse(query.sort ?? "latest");}
 catch {return <section className="page-container"><p role="alert">정렬과 페이지 번호를 확인해 주세요.</p><Link href={base}>리뷰 목록으로 돌아가기</Link></section>;}
 const reviews=await listReviews(null,username,page,sort);if(!reviews)notFound();
 return <section className="page-container review-detail"><Link className="text-link" href={"/u/"+username}>← 공개 프로필</Link><h1>@{username}의 공개 리뷰 · {reviews.total}개</h1>
  <ReviewSortControl base={base} sort={reviews.sort} available={reviews.engagementAvailable}/><ReviewList items={reviews.items}/>
  <nav className="library-pagination" aria-label="리뷰 페이지">{page>1 ? <Link href={reviewListUrl(base,reviews.sort,page-1)} prefetch={false}>이전</Link> : null}{reviews.hasNext && page<1000 ? <Link href={reviewListUrl(base,reviews.sort,page+1)} prefetch={false}>다음</Link> : null}</nav>
 </section>;
}
