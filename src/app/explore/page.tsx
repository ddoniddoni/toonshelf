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
  return <div className="page-container catalogue-page">
    <header className="catalogue-heading"><div><p className="eyebrow">한 작품, 여러 읽는 곳</p><h1>다음 이야기를 찾아봐요.</h1><p>플랫폼마다 흩어진 작품을, 내 취향의 순서로.</p></div><Link className="text-link" href="/submissions/new">찾는 작품이 없나요? 작품 제보</Link></header>
    {page.status === "error" ? <EmptyState title="검색을 다시 확인해 주세요" description={page.message} action={<Link className="button button-secondary" href="/explore">검색 초기화</Link>}/> :
      <><FilterForm filters={page.filters} options={page.status === "ready" ? page.options : null} disabled={page.status === "unconfigured"}/>
        {page.status === "unconfigured" ? <EmptyState title="작품 카탈로그를 준비하고 있어요" description="작품이 등록되면 여러 플랫폼의 공식 링크와 정보를 여기서 찾아볼 수 있어요."/> :
          <><div className="catalogue-results-heading"><h2>찾은 작품 <span>{page.result.total.toLocaleString("ko-KR")}편</span></h2><p>확인된 비성인 작품만 표시해요.</p></div>
            <div className="active-filters" aria-label="적용된 검색 조건">{page.filters.q ? <span>검색: {page.filters.q}</span> : null}{page.filters.platform.map(p=><span key={p}>{page.options?.platforms.find(v=>v.code === p)?.name ?? p}</span>)}{page.filters.genre.map(g=><span key={g}>{page.options?.genres.find(v=>v.slug === g)?.name ?? g}</span>)}</div>
            {page.result.items.length ? <div className="work-grid">{page.result.items.map(w=><WorkCard key={w.id} work={w}/>)}</div> : <EmptyState title={page.result.total ? "이 페이지에는 작품이 없어요" : "아직 찾은 작품이 없어요"} description="검색어를 줄이거나 필터를 풀어 보세요. 빠진 작품은 출처와 함께 제보할 수 있어요." action={<Link className="button button-secondary" href="/submissions/new">작품 제보하기</Link>}/>}
            <nav className="catalogue-pagination" aria-label="작품 검색 페이지"><Link className="text-link" href={filterUrl(page.filters)}>첫 페이지</Link>{page.result.nextCursor ? <Link className="button button-secondary" href={filterUrl(page.filters,page.result.nextCursor)}>다음 작품 보기</Link> : null}</nav>
          </>}
      </>}
  </div>;
}
