import { withReviewAvailability } from "@/lib/reviews/availability";
import { ReviewAvailabilityNotice } from "@/components/reviews/availability-notice";
import Link from "next/link";
import { notFound } from "next/navigation";
import { uuidSchema } from "@/lib/catalogue/model";
import { getReview } from "@/lib/reviews/data";
import { getReviewComment } from "@/lib/review-comments/data";
import { commentPageUrl } from "@/lib/review-comments/model";
import { CommentItem } from "@/components/review-comments/comment-item";
export const dynamic="force-dynamic";
export const metadata={title:"리뷰 댓글",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string;commentId:string}>}) {
 const {id,commentId}=await params;
 if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(commentId).success) notFound();
 const publication=await getReview(id);if (!publication) notFound();
 const loaded=await withReviewAvailability(()=>getReviewComment(commentId,publication.version));
 if(!loaded.available)return <section className="page-container review-detail"><h1>리뷰 댓글</h1><ReviewAvailabilityNotice href={`/reviews/${id}`}/></section>;
 const comment=loaded.value;
 if (!comment || comment.reviewId!==id || comment.deleted) notFound();
 return <section className="page-container review-detail"><Link className="text-link" href={`/reviews/${id}`} prefetch={false}>← 현재 공개 리뷰</Link><h1>{comment.parentId ? "리뷰 답글" : "리뷰 댓글"}</h1>
  <CommentItem key={`${comment.id}:${comment.version}:${comment.isSpoiler}:${publication.version}`} comment={comment} reviewVersion={publication.version}/>
  <Link className="text-link" href={commentPageUrl(id,comment.parentId)} prefetch={false}>{comment.parentId ? "원 댓글과 답글 보기 →" : "전체 댓글 보기 →"}</Link>
 </section>;
}
