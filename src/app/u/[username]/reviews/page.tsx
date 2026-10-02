import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicEnv } from "@/lib/env/public";
import { usernameSchema } from "@/lib/auth/validation";
import { listReviews } from "@/lib/reviews/data";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ReviewList } from "@/components/reviews/review-list";
export const dynamic = "force-dynamic";
export const metadata = {title:"회원 공개 리뷰",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{username:string}>;searchParams:Promise<SearchParams>}) {
 const {username} = await params;if(!getPublicEnv().supabase || !usernameSchema.safeParse(username).success)notFound();let page:number;
 try {page = parsePage((await searchParams).page);}catch{return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href={"/u/"+username+"/reviews"}>리뷰 목록으로 돌아가기</Link></section>;}
 const reviews = await listReviews(null,username,page);if(!reviews)notFound();
 return <section className="page-container review-detail"><Link className="text-link" href={"/u/"+username}>← 공개 프로필</Link><h1>@{username}의 공개 리뷰 · {reviews.total}개</h1><ReviewList items={reviews.items}/><nav className="library-pagination" aria-label="회원 리뷰 페이지">{page > 1 ? <Link href={"/u/"+username+"/reviews?page="+(page-1)}>이전</Link> : null}{reviews.hasNext ? <Link href={"/u/"+username+"/reviews?page="+(page+1)}>다음</Link> : null}</nav></section>;
}
