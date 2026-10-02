import Link from "next/link";
import { notFound } from "next/navigation";
import { getReview } from "@/lib/reviews/data";
import { getCurrentAccount } from "@/lib/auth/session";
import { getPublicEnv } from "@/lib/env/public";
import { ReviewText } from "@/components/reviews/plain-text";
import { ReviewBodyGate } from "@/components/reviews/body-gate";
import { ReportReviewForm,BlockForm } from "@/components/reviews/forms";
import { UserAvatar } from "@/components/account/user-avatar";
import { CopyToLibrary } from "@/components/library/record-form";
export const dynamic = "force-dynamic";
type Props = {params:Promise<{id:string}>};
export async function generateMetadata({params}:Props) {
 const review = await getReview((await params).id);
 if (!review) return {title:"리뷰를 찾을 수 없어요",robots:{index:false,follow:false}};
 const title = review.workTitle+" 리뷰";const description = "회원이 공개한 작품 리뷰예요. 스포일러 본문은 직접 펼친 뒤 확인할 수 있어요.";
 return {title,description,robots:{index:false,follow:false},alternates:{canonical:new URL("/reviews/"+review.id,getPublicEnv().siteUrl).href},openGraph:{title,description}};
}
export default async function Page({params}:Props) {
 const review = await getReview((await params).id);if (!review) notFound();
 const account = await getCurrentAccount();const active = account?.access.status === "active" && account.access.consents_current && Boolean(account.user.email_confirmed_at);
 const own = account?.user.id === review.authorId;
 return <article className="page-container review-detail"><Link className="text-link" href={"/works/"+review.workSlug}>← 작품 정보</Link><p className="eyebrow">READER'S NOTE</p><h1>{review.workTitle} 리뷰</h1><div className="review-author"><UserAvatar path={review.avatar} name={review.name}/><Link className="text-link" href={"/u/"+review.username}>{review.name}</Link></div><p className="field-hint">{new Date(review.publishedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} 게시 · {new Date(review.updatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} 수정 (한국 시간)</p>
  <p>{review.episode === null ? "" : "공개 기준 "+review.episode+"회차 · "}{review.ratingSteps === null ? "공개 별점 없음" : (review.ratingSteps/2).toFixed(1)+"점"}{review.canonicalTier ? " · 기본 티어 "+review.canonicalTier : ""}</p>
  {review.body === null ? <ReviewBodyGate key={review.version} id={review.id} version={review.version}/> : <ReviewText body={review.body}/>}
  {own ? <Link className="button button-secondary" href={"/me/reviews/"+review.id+"/edit"}>내 리뷰 수정</Link> : null}
  {active ? <CopyToLibrary workId={review.workId}/> : <Link className="text-link" href={"/auth/sign-in?returnTo="+encodeURIComponent("/reviews/"+review.id)}>로그인하고 내 서재에 저장하기</Link>}
  {active && !own ? <><details className="library-privacy-panel"><summary>리뷰 신고</summary><ReportReviewForm id={review.id}/></details><details className="library-privacy-panel"><summary>작성자 차단</summary><BlockForm userId={review.authorId} name={review.name}/></details></> : null}
  <p className="field-hint">좋아요와 댓글은 소셜 기능 개발에서 이어갈 예정이에요.</p>
 </article>;
}
