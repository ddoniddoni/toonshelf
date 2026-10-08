import { AuthFailure } from "@/lib/auth/errors";
import { withReviewAvailability } from "@/lib/reviews/availability";
import { getReviewLikeState } from "@/lib/reviews/like-data";
import { listReviewComments } from "@/lib/review-comments/data";
import { ReviewLikeButton } from "./like-button";
import { ReviewAvailabilityNotice } from "./availability-notice";
import { ReviewComments } from "@/components/review-comments/comment-list";

export async function ReviewDiscussion({id,version,own,active}:{id:string;version:number;own:boolean;active:boolean}) {
 let loaded;
 try {
  loaded=await withReviewAvailability(()=>Promise.all([getReviewLikeState(id),listReviewComments({reviewId:id,reviewVersion:version,parentId:null,page:1})]));
 } catch(error) {
  if(error instanceof AuthFailure && error.code==="CONFLICT")return <p role="status">리뷰가 변경됐어요. 페이지를 새로고침하면 최신 댓글을 볼 수 있어요.</p>;
  throw error;
 }
 if(!loaded.available)return <ReviewAvailabilityNotice href={`/reviews/${id}`}/>;
 const [likes,comments]=loaded.value;
 if(!comments || !likes || likes.version!==version)return <p role="status">리뷰 공개 상태가 변경됐어요. 페이지를 새로고침해 주세요.</p>;
 return <>
  <ReviewLikeButton key={`${id}:${version}:${likes.liked}:${likes.likeCount}:${likes.canLike}`} initial={likes} id={id} version={version} own={own} active={active}/>
  <ReviewComments key={`${id}:${version}`} reviewId={id} reviewVersion={version} active={active} result={comments}/>
 </>;
}
