import Link from "next/link";
import { notFound } from "next/navigation";
import { uuidSchema } from "@/lib/catalogue/model";
import { getPost } from "@/lib/posts/data";
import { getPostComment } from "@/lib/post-comments/data";
import { commentPageUrl } from "@/lib/post-comments/model";
import { CommentItem } from "@/components/post-comments/comment-item";
export const dynamic="force-dynamic";
export const metadata={title:"글 댓글",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string;commentId:string}>}) {
 const {id,commentId}=await params;
 if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(commentId).success) notFound();
 const publication=await getPost(id);if (!publication) notFound();
 const comment=await getPostComment(commentId,publication.version);
 if (!comment || comment.postId!==id || comment.deleted) notFound();
 return <section className="page-container review-detail"><Link className="text-link" href={`/posts/${id}`} prefetch={false}>← 현재 공개 글</Link><h1>{comment.parentId ? "글 답글" : "글 댓글"}</h1>
  <CommentItem key={`${comment.id}:${comment.version}:${comment.isSpoiler}:${publication.version}`} comment={comment} postVersion={publication.version}/>
  <Link className="text-link" href={commentPageUrl(id,comment.parentId)} prefetch={false}>{comment.parentId ? "원 댓글과 답글 보기 →" : "전체 댓글 보기 →"}</Link>
 </section>;
}
