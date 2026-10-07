import Link from "next/link";
import { notFound } from "next/navigation";
import { uuidSchema } from "@/lib/catalogue/model";
import { getTierPublication } from "@/lib/tiers/publication-data";
import { getTierComment } from "@/lib/comments/data";
import { commentPageUrl } from "@/lib/comments/model";
import { CommentItem } from "@/components/comments/comment-item";
export const dynamic="force-dynamic";
export const metadata={title:"티어표 댓글",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string;commentId:string}>}) {
 const {id,commentId}=await params;
 if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(commentId).success) notFound();
 const publication=await getTierPublication(id);if (!publication) notFound();
 const comment=await getTierComment(commentId,publication.version);
 if (!comment || comment.tierId!==id || comment.deleted) notFound();
 return <section className="page-container review-detail"><Link className="text-link" href={`/tiers/${id}`} prefetch={false}>← 현재 공개 티어표</Link><h1>{comment.parentId ? "티어표 답글" : "티어표 댓글"}</h1>
  <CommentItem key={`${comment.id}:${comment.version}:${comment.isSpoiler}:${publication.version}`} comment={comment} tierVersion={publication.version}/>
  <Link className="text-link" href={commentPageUrl(id,comment.parentId)} prefetch={false}>{comment.parentId ? "원 댓글과 답글 보기 →" : "전체 댓글 보기 →"}</Link>
 </section>;
}
