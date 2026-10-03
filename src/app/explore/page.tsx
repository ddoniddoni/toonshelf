import Link from "next/link";
import { FilterForm } from "@/components/catalogue/filter-form";
import { WorkCard } from "@/components/catalogue/work-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicEnv } from "@/lib/env/public";
import { actionError } from "@/lib/auth/errors";
import { catalogueOptions,searchWorks } from "@/lib/catalogue/data";
import { filterUrl,parseFilters,type SearchParams } from "@/lib/catalogue/model";
export const metadata = {title:"작품 찾기",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
async function load(params:SearchParams) {
  try {
    const filters = parseFilters(params);
    if (!getPublicEnv().supabase) return {status:"unconfigured" as const,filters};
    const [options,result] = await Promise.all([catalogueOptions(),searchWorks(filters,params.cursor)]);
    return {status:"ready" as const,filters,options,result};
  } catch(error) { return {status:"error" as const,message:actionError(error).error.message}; }
}
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
  const page = await load(await searchParams);
  return <div className="catalogue-page">
    <h1 className="sr-only">작품 탐색</h1>
    {page.status === "error" ? <div className="page-container"><EmptyState title="검색을 다시 확인해 주세요" description={page.message} action={<Link className="button button-secondary" href="/explore">검색 초기화</Link>}/></div> :
      <><section className="catalogue-filter-surface" aria-label="작품 검색과 필터"><FilterForm key={JSON.stringify(page.filters)} filters={page.filters} options={page.status === "ready" ? page.options : null} disabled={page.status === "unconfigured"} total={page.status === "ready" ? page.result.total : undefined}/></section>
        <div className="page-container catalogue-content">{page.status === "unconfigured" ? <EmptyState title="작품 카탈로그를 준비하고 있어요" description="작품이 등록되면 여러 플랫폼의 공식 링크와 정보를 여기서 찾아볼 수 있어요."/> :
          <><h2 className="sr-only">찾은 작품 {page.result.total.toLocaleString("ko-KR")}편</h2>
            <div className="active-filters" aria-label="적용된 검색 조건">{page.filters.q ? <span>검색: {page.filters.q}</span> : null}{page.filters.platform.map(p=><span key={p}>{page.options?.platforms.find(v=>v.code === p)?.name ?? p}</span>)}{page.filters.genre.map(g=><span key={g}>{page.options?.genres.find(v=>v.slug === g)?.name ?? g}</span>)}</div>
            {page.result.items.length ? <div className="work-grid">{page.result.items.map(w=><WorkCard key={w.id} work={w} rating={w.rating}/>)}</div> : <EmptyState title={page.result.total ? "이 페이지에는 작품이 없어요" : "아직 찾은 작품이 없어요"} description="검색어를 줄이거나 필터를 풀어 보세요. 빠진 작품은 출처와 함께 제보할 수 있어요." action={<Link className="button button-secondary" href="/submissions/new">작품 제보하기</Link>}/>}
            <nav className="catalogue-pagination" aria-label="작품 검색 페이지"><Link className="text-link" href={filterUrl(page.filters)}>첫 페이지</Link>{page.result.nextCursor ? <Link className="button button-secondary" href={filterUrl(page.filters,page.result.nextCursor)}>다음 작품 보기</Link> : null}</nav>
          </>}<aside className="catalogue-submission-note"><p>찾으시는 웹툰이 내 검색 결과에 없나요? 공식 출처와 함께 제보해 주세요.</p><Link className="button button-secondary" href="/submissions/new">누락 작품 제보하기 →</Link></aside></div>
      </>}
  </div>;
}
