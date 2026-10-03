import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { listTierDrafts } from "@/lib/tiers/data";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
import { TierDraftActions } from "@/components/tiers/draft-forms";
export const metadata={title:"내 티어표",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account=await guardPage("/me/tiers");if (!account) return <section className="page-container tier-list-page"><h1>내 티어표</h1><ConnectionNotice/></section>;
 const params=await searchParams;let page:number;try {page=parsePage(params.page);} catch {return <section className="page-container tier-list-page"><h1>내 티어표</h1><p role="alert">페이지 번호를 확인해 주세요.</p><Link href="/me/tiers">첫 페이지</Link></section>;}
 const result=await listTierDrafts(page);
 return <section className="page-container tier-list-page"><div className="hub-section-heading"><div><h1>내 티어표</h1><p>나만 보는 초안 · 배치는 서재와 기본 평가에 영향을 주지 않아요.</p></div><Link className="button button-primary" href="/tiers/new">새 티어표 만들기</Link></div>
  {params.deleted === "1" ? <p role="status">티어표의 초안·게시본·공유 링크를 삭제했어요.</p> : null}
  <div className="tier-list-grid">{result.items.map(item=><article className="tier-list-card" key={item.id}><span className="section-chip">비공개 초안</span><h2><Link href={`/tiers/${item.id}/edit`}>{item.title}</Link></h2><p>{item.description || "설명을 추가해 보세요."}</p><p>{item.workCount}편 · {item.tags.join(" · ")}</p><p>저장 <time dateTime={item.savedAt}>{new Date(item.savedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time></p><Link className="button button-secondary" href={`/tiers/${item.id}/edit`}>초안 편집</Link><TierDraftActions id={item.id} version={item.version}/></article>)}</div>
  {!result.items.length ? <p>저장된 초안이 없어요. 새 티어표를 만들어 작품을 배치해 보세요.</p> : null}
  <nav className="library-pagination" aria-label="내 티어표 페이지">{page > 1 ? <Link className="button button-secondary" href={`/me/tiers?page=${page-1}`}>이전</Link> : null}{result.hasNext ? <Link className="button button-secondary" href={`/me/tiers?page=${page+1}`}>다음</Link> : null}</nav>
 </section>;
}
