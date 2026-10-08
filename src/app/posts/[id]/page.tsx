import Link from "next/link";
import { getPostLikeState } from "@/lib/posts/like-data";
import { PostLikeButton } from "@/components/posts/like-button";
import { PostComments } from "@/components/post-comments/comment-list";
import { listPostComments } from "@/lib/post-comments/data";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/posts/data";
import { categoryLabels } from "@/lib/posts/model";
import { getCurrentAccount } from "@/lib/auth/session";
import { UserAvatar } from "@/components/account/user-avatar";
import { PostBodyGate } from "@/components/posts/body-gate";
import { PostContent } from "@/components/posts/post-content";
import { ReportPostForm } from "@/components/posts/moderation-forms";
import { BlockForm } from "@/components/reviews/forms";
export const dynamic="force-dynamic";
// Generic metadata deliberately contains no user title, excerpt, or attached work.
export const metadata={title:"커뮤니티 이야기",description:"독자들이 나누는 작품 이야기",robots:{index:false,follow:false},openGraph:{title:"ToonShelf 커뮤니티",description:"함께 읽고 나누는 작품 이야기"}};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;const [post,account]=await Promise.all([getPost(id),getCurrentAccount()]);if(!post)notFound();
 const [likeState,comments]=await Promise.all([getPostLikeState(id),listPostComments({postId:id,postVersion:post.version,parentId:null,page:1})]);
 const own=account?.user.id===post.authorId;const active=account?.access.status==="active" && account.access.consents_current && Boolean(account.user.email_confirmed_at);
 return <article className="page-container review-detail"><Link className="text-link" href="/community">← 커뮤니티</Link><p className="eyebrow">{categoryLabels[post.category]}</p><h1>{post.isSpoiler ? "스포일러가 포함된 이야기" : "독자의 이야기"}</h1><div className="review-author"><UserAvatar path={post.avatar} name={post.name}/><Link className="text-link" href={`/u/${post.username}`} prefetch={false}>{post.name}</Link></div><p className="field-hint">{new Date(post.publishedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} 게시 · {new Date(post.updatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} 수정 (한국 시간)</p>
 {post.body===null || post.title===null ? <PostBodyGate key={post.version} id={post.id} version={post.version}/> : <PostContent title={post.title} body={post.body} works={post.works}/>}
 <PostLikeButton key={`${post.id}:${post.version}`} initial={likeState} id={post.id} version={post.version} own={own} active={active}/>
 <PostComments postId={id} postVersion={post.version} active={active} result={comments}/>
 {own ? <Link className="button button-secondary" href={`/me/posts/${post.id}/edit`} prefetch={false}>내 글 수정</Link> : null}
 {active && !own ? <><details className="library-privacy-panel"><summary>글 신고</summary><ReportPostForm id={post.id}/></details><details className="library-privacy-panel"><summary>작성자 차단</summary><BlockForm userId={post.authorId} name={post.name}/></details></> : null}
 </article>;
}
