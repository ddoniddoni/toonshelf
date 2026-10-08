import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { listMyPosts } from "@/lib/posts/data";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"내 글과 초안",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account=await guardPage("/me/posts");if(!account)return <section className="page-container review-detail"><h1>내 글과 초안</h1><ConnectionNotice/></section>;
 const params=await searchParams;let page:number;try{page=parsePage(params.page);}catch{return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href="/me/posts">내 글로 돌아가기</Link></section>;}
 const posts=await listMyPosts(page);
 return <section className="page-container review-detail"><p className="eyebrow">MY STORIES</p><h1>내 글과 초안</h1><p>수정 초안과 현재 게시본을 따로 관리해요.</p><div className="post-heading-actions"><Link className="button button-primary" href="/community/new" prefetch={false}>새 글 쓰기</Link><Link className="text-link" href="/community">커뮤니티</Link><Link className="text-link" href="/me/post-reports" prefetch={false}>내 글 신고 접수</Link></div>{params.deleted==="1" ? <p role="status">글과 초안을 삭제했어요.</p> : null}
 <div className="review-list">{posts.items.map(post=><article key={post.id} className="review-card"><h2>{post.title || "제목 없는 초안"}</h2><p>{post.publicationStatus==="published" ? "게시됨" : "비공개 초안"} · {post.moderationStatus==="hidden" ? "운영자 숨김" : "운영 제한 없음"}</p><p className="field-hint">초안 저장: {new Date(post.updatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</p><Link className="text-link" href={`/me/posts/${post.id}/edit`} prefetch={false}>편집·게시 관리 →</Link></article>)}</div>{!posts.items.length ? <p>이 페이지에 작성한 글이 없어요.</p> : null}
 <nav className="library-pagination" aria-label="내 글 페이지">{page>1 ? <Link href={`/me/posts?page=${page-1}`} prefetch={false}>이전</Link> : null}{posts.hasNext ? <Link href={`/me/posts?page=${page+1}`} prefetch={false}>다음</Link> : null}</nav></section>;
}
