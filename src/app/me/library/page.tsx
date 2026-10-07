import Link from "next/link";
import { z } from "zod";
import { BookOpen, LockKeyhole, SlidersHorizontal, X } from "lucide-react";
import { guardPage } from "@/lib/auth/session";
import { catalogueOptions, getWorkDetail } from "@/lib/catalogue/data";
import { getMyProfile } from "@/lib/auth/data";
import { getMyLibrary, getReadingStats } from "@/lib/library/data";
import { libraryUrl, parseLibraryFilters, parsePage, readingLabels, type LibraryFilters } from "@/lib/library/model";
import { uuidSchema, type SearchParams } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
import { LibraryFilterForm } from "@/components/library/filter-form";
import { BulkLibraryForm } from "@/components/library/bulk-form";
import { ReadingStatistics } from "@/components/library/reading-stats";
import { AllPrivateForm, RecordForm } from "@/components/library/record-form";
import { UserAvatar } from "@/components/account/user-avatar";
import { WorkCover } from "@/components/catalogue/work-cover";
export const metadata = {title:"내 서재",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
  const account = await guardPage("/me/library");
  if (!account) return <section className="page-container library-page"><h1>내 서재</h1><ConnectionNotice/></section>;
  const params = await searchParams;
  let filters:LibraryFilters,page:number,view:"list"|"cards",editId:string|null;
  try { filters = parseLibraryFilters(params);page = parsePage(params.page);view = z.enum(["list","cards"]).parse(params.view ?? "cards");editId = params.edit === undefined || params.edit === "none" ? null : uuidSchema.parse(params.edit); }
  catch { return <section className="page-container library-page"><h1>내 서재</h1><p role="alert">검색 조건을 확인해 주세요.</p><Link className="text-link" href="/me/library">조건 초기화</Link></section>; }
  const [library,stats,options,profile] = await Promise.all([getMyLibrary(filters,page),getReadingStats(),catalogueOptions(),getMyProfile()]);
  const pageUrl = (n:number)=>libraryUrl(filters,n)+"&view="+view;
  const selected = params.edit === "none" ? null : library.items.find(item=>item.workId === editId) ?? (editId === null ? library.items.find(item=>item.work !== null) ?? null : null);
  const work = selected?.work ? await getWorkDetail(selected.work.slug) : null;
  const total = Object.values(stats?.statuses ?? {}).reduce((sum,count)=>sum+count,0);
  return <section className="page-container library-page">
    <Link className="text-link" href="/me/feed" prefetch={false}>팔로우한 독자의 새 게시물 →</Link>
    <Link className="text-link" href="/me/library/merges">내 작품 병합 이력 · 원본 기록 확인 →</Link>
    {params.changed === "1" || params.private === "1" ? <p role="status" className="form-success">기록 변경을 저장했어요.</p> : null}
    <div className="library-layout"><div className="library-main"><section className="library-profile-card"><div className="library-heading"><div className="library-owner"><UserAvatar path={profile?.avatar_path ?? null} name={profile?.display_name ?? "나"}/><div><h1>{profile?.display_name ? profile.display_name+"의 서재" : "내 서재"}</h1><p>플랫폼은 달라도 나의 독서 기록은 한곳에.</p></div></div><div className="library-heading-actions">{profile?.username ? <Link className="button button-secondary" href={"/u/"+profile.username}>공개 서재 보기</Link> : null}<Link className="button button-secondary" href="/settings/privacy"><SlidersHorizontal size={14} aria-hidden="true"/>공개 설정</Link></div></div>
      {stats ? <ReadingStatistics stats={stats} compact/> : null}
      <nav className="library-status-tabs" aria-label="읽기 상태로 서재 찾기"><Link href={libraryUrl({...filters,status:null})+"&view="+view} aria-current={filters.status === null ? "page" : undefined}>전체 <span>{total}</span></Link>{(Object.keys(readingLabels) as (keyof typeof readingLabels)[]).map(status=><Link key={status} href={libraryUrl({...filters,status})+"&view="+view} aria-current={filters.status === status ? "page" : undefined}>{readingLabels[status]} <span>{stats?.statuses[status] ?? 0}</span></Link>)}</nav>
    </section><LibraryFilterForm filters={filters} platforms={options?.platforms ?? []} genres={options?.genres ?? []} view={view}/><p className="library-result-count">검색 결과 {library.total}편 · {page}페이지 · 개인 태그와 평가는 비공개 기록도 포함해요.</p>
      {library.items.length ? <BulkLibraryForm key={pageUrl(page)} items={library.items} view={view} baseUrl={pageUrl(page)} editingId={selected?.workId ?? null}/> : <div className="library-empty"><BookOpen size={28} aria-hidden="true"/><h2>{library.total ? "이 페이지에 기록이 없어요" : "아직 조건에 맞는 기록이 없어요"}</h2><p>작품 상세에서 내 서재에 저장하거나 검색 조건을 바꿔 보세요.</p><Link className="text-link" href="/explore">작품 찾기 →</Link></div>}
      <nav className="library-pagination" aria-label="서재 페이지">{page > 1 ? <Link className="button button-secondary" href={pageUrl(page-1)}>이전</Link> : null}{library.hasNext ? <Link className="button button-secondary" href={pageUrl(page+1)}>다음</Link> : null}</nav>
      <details className="library-privacy-panel"><summary>공개한 서재와 평가를 모두 비공개로 바꾸기</summary><AllPrivateForm/></details>
    </div><aside className="library-record-panel" id="library-record-panel" aria-labelledby="record-panel-title"><div className="record-panel-heading"><h2 id="record-panel-title"><BookOpen size={18} aria-hidden="true"/>빠른 기록 편집</h2>{selected ? <Link className="header-icon" href={pageUrl(page)+"&edit=none"} aria-label="기록 편집 패널 닫기"><X size={16} aria-hidden="true"/></Link> : null}</div>
      {selected && work ? <><div className="record-selected-work"><WorkCover title={work.title} assetId={work.coverAssetId}/><div><h3>{work.title}</h3><p>{work.genres.map(genre=>genre.name).join(" · ")}</p><Link className="text-link" href={"/works/"+work.slug}>작품 상세 보기 →</Link></div></div><RecordForm key={selected.workId+":"+selected.version} work={work} record={selected} defaults={{library:selected.libraryVisibility,evaluation:selected.evaluationVisibility}} layout="panel"/></> : selected ? <><p>현재 제공할 수 없는 작품이에요. 기존 개인 기록은 별도 화면에서 확인·삭제할 수 있어요.</p><Link className="text-link" href={"/me/library/"+selected.workId}>내 기록 확인하기 →</Link></> : <div className="record-panel-empty"><BookOpen size={32} aria-hidden="true"/><h3>작품을 선택해 기록해 보세요.</h3><p>읽기 상태, 별점과 기본 티어를 이곳에서 편집할 수 있어요.</p><div><LockKeyhole size={16} aria-hidden="true"/><p>회차·메모·개인 태그는 나만 볼 수 있어요.</p></div><Link className="button button-secondary" href="/explore">작품 찾아보기</Link></div>}
    </aside></div>
  </section>;
}
