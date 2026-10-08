import Link from "next/link";
import { UserAvatar } from "@/components/account/user-avatar";
import { categoryLabels,type PostCard } from "@/lib/posts/model";
export function PostList({posts}:{posts:PostCard[]}) {
 return <div className="review-list">{posts.map(post=><article key={post.id} className="review-card post-card">
  <p className="eyebrow">{categoryLabels[post.category]}{post.isSpoiler ? " · 스포일러" : ""}</p>
  <h2><Link href={`/posts/${post.id}`} prefetch={false}>{post.title ?? "스포일러가 포함된 글"}</Link></h2>
  <p className="following-feed-excerpt">{post.excerpt ?? "제목과 내용은 상세 화면에서 직접 펼쳐 볼 수 있어요."}</p>
  <div className="review-author"><UserAvatar path={post.avatar} name={post.name}/><Link className="text-link" href={`/u/${post.username}`} prefetch={false}>{post.name}</Link><time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</time></div>
  {post.works.length ? <div className="post-work-links">{post.works.map(work=><Link className="text-link" key={work.id} href={`/works/${work.slug}`} prefetch={false}>{work.title}</Link>)}</div> : null}
 </article>)}</div>;
}
