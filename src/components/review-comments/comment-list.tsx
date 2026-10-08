import Link from "next/link";
import { commentPageUrl,type CommentPage } from "@/lib/review-comments/model";
import { CommentItem } from "./comment-item";
import { CommentComposer } from "./comment-composer";
export function CommentList({result,page}:{result:CommentPage;page:number}) {
 return <><div className="review-list">{result.items.map(c=><CommentItem key={`${c.id}:${c.version}:${c.isSpoiler}:${result.reviewVersion}`} comment={c} reviewVersion={result.reviewVersion}/>)}</div>
  {!result.items.length ? <p>{page > 1 ? "이 페이지에 볼 수 있는 댓글이 없어요." : "현재 볼 수 있는 댓글이 없어요."}</p> : null}
  <nav className="library-pagination" aria-label={result.parentId ? "답글 페이지" : "댓글 페이지"}>{page > 1 ? <Link href={commentPageUrl(result.reviewId,result.parentId,page-1)} prefetch={false}>이전</Link> : null}{result.hasNext && page < 1000 ? <Link href={commentPageUrl(result.reviewId,result.parentId,page+1)} prefetch={false}>다음</Link> : null}</nav></>;
}
export function ReviewComments({reviewId,reviewVersion,active,result}:{reviewId:string;reviewVersion:number;active:boolean;result:CommentPage|null}) {
 return <section id="comments" className="tier-comments" aria-labelledby="review-comments-title"><div className="section-heading"><h2 id="review-comments-title">댓글</h2><Link className="text-link" href={commentPageUrl(reviewId)} prefetch={false}>댓글·답글 전체 페이지 →</Link></div>
  <p className="field-hint">현재 공개된 리뷰의 댓글만 보여요. 차단·운영 숨김·계정 상태에 따라 표시할 수 있는 댓글이 달라져요. 댓글은 최신순, 답글은 작성순이에요.</p>
  {result ? <><CommentList result={result} page={1}/>{active ? <CommentComposer reviewId={reviewId} reviewVersion={reviewVersion}/> : <Link className="text-link" href={`/auth/sign-in?returnTo=${encodeURIComponent(commentPageUrl(reviewId))}`}>로그인하고 댓글 작성하기</Link>}</> : <p>현재 댓글을 조회할 수 없어요. 최신 게시본을 불러와 주세요.</p>}
 </section>;
}
