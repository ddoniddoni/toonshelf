import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { listMyReviews } from "@/lib/reviews/data";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic = "force-dynamic";
export const metadata = {title:"내 리뷰",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account = await guardPage("/me/reviews");if(!account) return <section className="page-container review-detail"><h1>내 리뷰</h1><ConnectionNotice/></section>;
 const params = await searchParams;let page:number;try {page = parsePage(params.page);}catch {return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href="/me/reviews">내 리뷰로 돌아가기</Link></section>;}
 const reviews = await listMyReviews(page);
 return <section className="page-container review-detail"><p className="eyebrow">MY READER'S NOTES</p><h1>내 리뷰 · {reviews.total}개</h1><p>비공개 초안과 게시 상태를 확인해요. 작품당 현재 리뷰는 한 개예요.</p>{params.deleted === "1" ? <p role="status">리뷰와 수정 초안을 삭제했어요.</p> : null}<div className="review-list">{reviews.items.map(r=><article key={r.id} className="review-card"><h2>{r.work?.title ?? "현재 제공할 수 없는 작품"}</h2><p>{r.publicationStatus === "published" ? "게시됨" : "비공개"} · {r.moderationStatus === "hidden" ? "운영자 숨김" : "운영 제한 없음"}</p><p className="field-hint">초안 저장: {new Date(r.draftUpdatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} (한국 시간)</p><Link className="text-link" href={"/me/reviews/"+r.id+"/edit"}>초안 / 게시 관리 →</Link></article>)}</div>{!reviews.items.length ? <p>이 페이지에 리뷰가 없어요. 작품 상세에서 리뷰를 시작해 보세요.</p> : null}<Link className="text-link" href="/explore">작품 찾기</Link><nav className="library-pagination" aria-label="내 리뷰 페이지">{page > 1 ? <Link href={"/me/reviews?page="+(page-1)}>이전</Link> : null}{reviews.hasNext ? <Link href={"/me/reviews?page="+(page+1)}>다음</Link> : null}</nav></section>;
}
