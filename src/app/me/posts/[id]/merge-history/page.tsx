import Link from "next/link";
import { notFound } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { AuthFailure } from "@/lib/auth/errors";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { parsePage } from "@/lib/library/model";
import { getMyPostMergeHistory } from "@/lib/posts/merge-data";
import { postMergeHistoryUrl } from "@/lib/posts/merge-model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"내 글의 작품 연결 변경 이력",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<SearchParams>}) {
 const {id}=await params;if(!uuidSchema.safeParse(id).success)notFound();
 const account=await guardPage(postMergeHistoryUrl(id));if(!account)return <section className="page-container review-detail"><h1>작품 연결 변경 이력</h1><ConnectionNotice/></section>;
 let page:number;try {page=parsePage((await searchParams).page);}catch{return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href={postMergeHistoryUrl(id)}>첫 페이지로</Link></section>;}
 let history;
 try {history=await getMyPostMergeHistory({id,page});}
 catch(error) {
  if(error instanceof AuthFailure && error.code==="CONFIG_REQUIRED")return <section className="page-container review-detail"><h1>작품 연결 변경 이력</h1><p role="status">작품 연결 이력 기능을 준비하고 있어요. 잠시 후 다시 방문해 주세요.</p><Link href="/me/posts">내 글과 초안으로</Link></section>;
  throw error;
 }
 if(!history)notFound();
 return <section className="page-container review-detail"><Link className="text-link" href={`/me/posts/${id}/edit`} prefetch={false}>← 내 글 편집</Link><h1>작품 연결 변경 이력</h1><p>중복 작품을 합치면서 변경된 내 글과 초안의 작품 연결이에요. 본문은 바꾸거나 자동으로 게시하지 않아요. 이 이력은 작성자만 볼 수 있어요.</p>
  <div className="review-list">{history.items.map(item=><article className="review-card" key={item.id}><h2>{item.sourceTitle} → {item.targetTitle}</h2><p>게시본 연결 {item.publishedBefore.length}개 → {item.publishedAfter.length}개</p>{item.draftBefore && item.draftAfter ? <p>편집 초안 연결 {item.draftBefore.length}개 → {item.draftAfter.length}개</p> : null}<p className="field-hint">중복된 연결은 먼저 나온 위치에 하나로 정리했어요.</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time></article>)}</div>
  {!history.items.length ? <p>{page>1 ? "이 페이지에 변경 이력이 없어요." : "아직 작품 병합으로 바뀐 연결이 없어요."}</p> : null}
  <nav className="library-pagination" aria-label="작품 연결 이력 페이지">{page>1 ? <Link href={postMergeHistoryUrl(id,page-1)} prefetch={false}>이전</Link> : null}{history.hasNext && page<1000 ? <Link href={postMergeHistoryUrl(id,page+1)} prefetch={false}>다음</Link> : null}</nav>
 </section>;
}
