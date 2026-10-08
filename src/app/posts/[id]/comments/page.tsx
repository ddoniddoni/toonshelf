import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/posts/data";
import { getCurrentAccount } from "@/lib/auth/session";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { getPostComment,listPostComments } from "@/lib/post-comments/data";
import { commentPageUrl,commentQuerySchema } from "@/lib/post-comments/model";
import { CommentList } from "@/components/post-comments/comment-list";
import { CommentItem } from "@/components/post-comments/comment-item";
import { CommentComposer } from "@/components/post-comments/comment-composer";
export const dynamic="force-dynamic";
export const metadata={title:"글 댓글·답글",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<SearchParams>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const query=commentQuerySchema.safeParse(await searchParams);if (!query.success) return <section className="page-container"><p role="alert">댓글 페이지와 원 댓글을 확인해 주세요.</p><Link href={commentPageUrl(id)}>댓글 첫 페이지</Link></section>;
 const publication=await getPost(id);if (!publication) notFound();const {parentId,page}=query.data;
 const [result,parent,account]=await Promise.all([listPostComments({postId:id,postVersion:publication.version,parentId,page}),parentId ? getPostComment(parentId,publication.version) : Promise.resolve(null),getCurrentAccount()]);
 if (!result || (parentId && (!parent || parent.postId !== id || parent.parentId !== null))) notFound();
 const active=account?.access.status === "active" && account.access.consents_current && Boolean(account.user.email_confirmed_at);
 return <section className="page-container review-detail" id="comments"><Link className="text-link" href={`/posts/${id}`} prefetch={false}>← 현재 공개 글</Link><h1>{parentId ? "댓글의 답글" : "글 댓글"}</h1>
  {parent ? <><CommentItem key={`${parent.id}:${parent.version}:${parent.isSpoiler}:${publication.version}`} comment={parent} postVersion={publication.version}/><Link href={commentPageUrl(id)} prefetch={false} className="text-link">전체 댓글로 돌아가기 →</Link></> : null}
  <p className="field-hint">댓글은 최신순, 답글은 작성순으로 20개씩 보여요. 스포일러·차단·운영 조치는 현재 상태를 확인해요.</p><CommentList result={result} page={page}/>
  {active && (!parent || parent.canReply) ? <CommentComposer key={`${parentId}:${publication.version}`} postId={id} postVersion={publication.version} parentId={parentId}/> : parent?.deleted ? <p>삭제된 원 댓글에는 새 답글을 달 수 없어요.</p> : !active ? <Link className="text-link" href={`/auth/sign-in?returnTo=${encodeURIComponent(commentPageUrl(id,parentId,page))}`}>로그인하고 댓글 작성하기</Link> : null}
 </section>;
}
