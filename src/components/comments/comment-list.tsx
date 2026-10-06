import Link from "next/link";
import { listTierComments } from "@/lib/comments/data";
import { commentPageUrl,type CommentPage } from "@/lib/comments/model";
import { CommentItem } from "./comment-item";
import { CommentComposer } from "./comment-composer";
export function CommentList({result,page}:{result:CommentPage;page:number}) {
 return <><div className="review-list">{result.items.map(c=><CommentItem key={`${c.id}:${c.version}:${c.isSpoiler}:${result.tierVersion}`} comment={c} tierVersion={result.tierVersion}/>)}</div>
  {!result.items.length ? <p>{page > 1 ? "이 페이지에 볼 수 있는 댓글이 없어요." : "현재 볼 수 있는 댓글이 없어요."}</p> : null}
  <nav className="library-pagination" aria-label={result.parentId ? "답글 페이지" : "댓글 페이지"}>{page > 1 ? <Link href={commentPageUrl(result.tierId,result.parentId,page-1)} prefetch={false}>이전</Link> : null}{result.hasNext && page < 1000 ? <Link href={commentPageUrl(result.tierId,result.parentId,page+1)} prefetch={false}>다음</Link> : null}</nav></>;
}
export async function TierComments({tierId,tierVersion,active}:{tierId:string;tierVersion:number;active:boolean}) {
 const result=await listTierComments({tierId,tierVersion,parentId:null,page:1});
 return <section id="comments" className="tier-comments" aria-labelledby="tier-comments-title"><div className="section-heading"><h2 id="tier-comments-title">댓글</h2><Link className="text-link" href={commentPageUrl(tierId)} prefetch={false}>댓글·답글 전체 페이지 →</Link></div>
  <p className="field-hint">현재 공개된 티어표의 댓글만 보여요. 차단·운영 숨김·계정 상태에 따라 표시할 수 있는 댓글이 달라져요. 댓글은 최신순, 답글은 작성순이에요.</p>
  {result ? <><CommentList result={result} page={1}/>{active ? <CommentComposer tierId={tierId} tierVersion={tierVersion}/> : <Link className="text-link" href={`/auth/sign-in?returnTo=${encodeURIComponent(commentPageUrl(tierId))}`}>로그인하고 댓글 작성하기</Link>}</> : <p>현재 댓글을 조회할 수 없어요. 최신 게시본을 불러와 주세요.</p>}
 </section>;
}
