import Link from "next/link";
import { UserAvatar } from "@/components/account/user-avatar";
import type { ReviewCard } from "@/lib/reviews/model";
export function ReviewList({items,variant="list"}:{items:ReviewCard[];variant?:"list"|"feed"}) {
 return <div className={"review-list review-"+variant}>{items.length ? items.map(review=><article className="review-card" key={review.id}>
  <div className="review-card-heading"><div className="review-author"><UserAvatar path={review.avatar} name={review.name}/><div><Link className="review-author-name" href={"/u/"+review.username}>{review.name}</Link><p className="field-hint">{new Date(review.publishedAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})} 게시 · {new Date(review.updatedAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})} 수정</p></div></div><Link className="review-work-tag" href={"/works/"+review.workSlug}>{review.workTitle}</Link></div>
  <Link href={"/reviews/"+review.id}><h3 className={variant === "feed" ? "sr-only" : undefined}>{review.workTitle} 리뷰</h3><p className={review.isSpoiler ? "review-spoiler-note" : "review-excerpt"}>{review.isSpoiler ? "스포일러 포함 · 상세에서 직접 펼칠 수 있어요" : review.excerpt}</p></Link>
  <div className="review-card-footer"><p className="field-hint">{review.episode === null ? "" : "공개 기준 "+review.episode+"회차 · "}<span className="review-rating">{review.ratingSteps === null ? "공개 별점 없음" : "★ "+(review.ratingSteps/2).toFixed(1)}</span>{review.canonicalTier ? " · 티어 "+review.canonicalTier : ""}</p><Link className="text-link" href={"/reviews/"+review.id}>리뷰 읽기 →</Link></div>
 </article>) : <div className="review-empty"><p>아직 열람 가능한 공개 리뷰가 없어요.</p><Link className="text-link" href="/me/reviews">첫 리뷰 남기기 →</Link></div>}</div>;
}
