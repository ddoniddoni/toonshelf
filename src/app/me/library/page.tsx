import Link from "next/link";
import { z } from "zod";
import { guardPage } from "@/lib/auth/session";
import { catalogueOptions } from "@/lib/catalogue/data";
import { getMyLibrary,getReadingStats } from "@/lib/library/data";
import { libraryUrl,parseLibraryFilters,parsePage,type LibraryFilters } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
import { LibraryFilterForm } from "@/components/library/filter-form";
import { BulkLibraryForm } from "@/components/library/bulk-form";
import { ReadingStatistics } from "@/components/library/reading-stats";
import { AllPrivateForm } from "@/components/library/record-form";
export const metadata = {title:"내 서재",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account = await guardPage("/me/library");
 if (!account) return <section className="page-container library-page"><h1>내 서재</h1><ConnectionNotice/></section>;
 const params = await searchParams;
 let filters:LibraryFilters,page:number,view:"list"|"cards";
 try { filters = parseLibraryFilters(params);page = parsePage(params.page);view = z.enum(["list","cards"]).parse(params.view ?? "list"); }
 catch { return <section className="page-container library-page"><h1>내 서재</h1><p role="alert">검색 조건을 확인해 주세요.</p><Link className="text-link" href="/me/library">조건 초기화</Link></section>; }
 const [library,stats,options] = await Promise.all([getMyLibrary(filters,page),getReadingStats(),catalogueOptions()]);
 const pageUrl = (n:number)=>libraryUrl(filters,n)+"&view="+view;
 return <section className="page-container library-page"><div className="library-heading"><div><p className="eyebrow">MY READING SHELF</p><h1>이야기가 쌓이는 자리</h1><p>읽은 만큼 기록하고, 나누고 싶은 것만 공개해요.</p></div><Link className="button button-secondary" href="/explore">작품 찾아 기록하기</Link></div>
  {params.changed === "1" || params.private === "1" ? <p role="status" className="form-success">기록 변경을 저장했어요.</p> : null}
  {stats ? <ReadingStatistics stats={stats}/> : null}
  <LibraryFilterForm filters={filters} platforms={options?.platforms ?? []} genres={options?.genres ?? []} view={view}/><p className="field-hint">검색 결과 {library.total}편 · {page}페이지. 개인 태그와 평가 필터는 내 비공개 기록도 포함해요.</p>
  {library.items.length ? <BulkLibraryForm items={library.items} view={view}/> : <div className="library-empty"><h2>{library.total ? "이 페이지에 기록이 없어요" : "아직 조건에 맞는 기록이 없어요"}</h2><p>작품 상세에서 내 서재에 저장하거나 검색 조건을 바꿔 보세요.</p><Link className="text-link" href="/explore">작품 찾기 →</Link></div>}
  <nav className="library-pagination" aria-label="서재 페이지">{page > 1 ? <Link className="button button-secondary" href={pageUrl(page-1)}>이전</Link> : null}{library.hasNext ? <Link className="button button-secondary" href={pageUrl(page+1)}>다음</Link> : null}</nav>
  <details className="library-privacy-panel"><summary>공개한 서재와 평가를 모두 비공개로 바꾸기</summary><AllPrivateForm/></details>
 </section>;
}
