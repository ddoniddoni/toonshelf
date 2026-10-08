import Link from "next/link";
import { z } from "zod";
import { listPosts } from "@/lib/posts/data";
import { categoryLabels,communityUrl,filtersSchema,type PostFilters } from "@/lib/posts/model";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { getPublicEnv } from "@/lib/env/public";
import { ConnectionNotice } from "@/components/auth/auth-shell";
import { PostList } from "@/components/posts/post-list";
export const dynamic="force-dynamic";
export const metadata={title:"커뮤니티",description:"함께 읽을 작품을 찾고, 감상과 이야기를 나누세요.",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const params=await searchParams;let filters:PostFilters;
 try{filters=filtersSchema.parse({q:z.string().parse(params.q??"").trim(),category:params.category||null,work:params.work||null,page:parsePage(params.page),sort:params.sort??"latest"});}catch{return <section className="page-container review-detail"><h1>커뮤니티</h1><p role="alert">검색 조건과 페이지 주소를 확인해 주세요.</p><Link href="/community">전체 글 보기</Link></section>;}
 const posts=getPublicEnv().supabase ? await listPosts(filters) : null;
 return <section className="page-container community-page"><header className="catalogue-heading"><div><p className="eyebrow">COMMUNITY</p><h1>같은 이야기를 읽는 우리</h1><p>다음에 읽을 작품부터 오래 남은 감상까지.</p></div><div className="post-heading-actions"><Link className="button button-secondary" href="/me/posts" prefetch={false}>내 글과 초안</Link><Link className="button button-primary" href="/community/new" prefetch={false}>글 쓰기</Link></div></header>
 <form method="get" action="/community" className="post-filters" role="search"><label>주제<select name="category" defaultValue={filters.category??""}><option value="">전체 주제</option>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>제목·본문 검색<input name="q" type="search" defaultValue={filters.q} maxLength={100} placeholder="어떤 이야기를 찾으세요?"/></label>{filters.work ? <input type="hidden" name="work" value={filters.work}/> : null}<label>정렬<select name="sort" defaultValue={filters.sort}><option value="latest">최신순</option><option value="popular">최근 7일 인기순</option></select></label><button className="button button-secondary">찾기</button><Link className="text-link" href="/community">조건 초기화</Link></form>
 <p className="field-hint">최신순은 최초 게시 기준, 인기순은 최근 7일 좋아요 + 서로 다른 댓글 참여자 × 2예요. · 스포일러 글의 숨겨진 제목·본문·연결 작품은 검색하지 않아요.{filters.work ? " · 선택한 작품과 연결된 글" : ""}</p>
 {posts ? <><PostList posts={posts.items} showPopularity={filters.sort==="popular"}/>{!posts.items.length ? <div className="library-empty"><h2>아직 이곳에 이야기가 없어요</h2><p>검색 조건을 바꾸거나 첫 이야기를 남겨 보세요.</p></div> : null}<nav className="library-pagination" aria-label="커뮤니티 페이지">{filters.page>1 ? <Link href={communityUrl({...filters,page:filters.page-1})} prefetch={false}>이전</Link> : null}{posts.hasNext ? <Link href={communityUrl({...filters,page:filters.page+1})} prefetch={false}>다음</Link> : null}</nav></> : <ConnectionNotice/>}</section>;
}
