import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookOpen, MessageSquare, Star } from "lucide-react";
import { getPublicEnv } from "@/lib/env/public";
import { getWorkDetail, searchWorks } from "@/lib/catalogue/data";
import { ageLabels, dayLabels, parseFilters, roleLabels, serialLabels, type WorkCard } from "@/lib/catalogue/model";
import { WorkCover } from "@/components/catalogue/work-cover";
import { getCurrentAccount, memberDestination } from "@/lib/auth/session";
import { getMySettings } from "@/lib/auth/data";
import { getMyRecord, getWorkStats } from "@/lib/library/data";
import { RecordForm } from "@/components/library/record-form";
import { listReviews } from "@/lib/reviews/data";
import { ReviewList } from "@/components/reviews/review-list";
import { CreateReviewForm } from "@/components/reviews/forms";
import { PlatformBadge } from "@/components/ui/catalogue-badges";
import { TierDistribution } from "@/components/ui/tier-distribution";
export const dynamic = "force-dynamic";
type Props = {params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props) {
  const {slug} = await params;const work = await getWorkDetail(slug);
  if (!work) return {title:"작품을 찾을 수 없어요",robots:{index:false,follow:false}};
  return {title:work.title,description:work.description.slice(0,160) || work.title+"의 작품 정보와 공식 플랫폼 링크",alternates:{canonical:new URL("/works/"+work.slug,getPublicEnv().siteUrl).href}};
}
async function relatedWorks(genre:string|undefined,id:string):Promise<WorkCard[]> {
  if (!genre) return [];
  try { return (await searchWorks(parseFilters({genre}),undefined,5)).items.filter(work=>work.id !== id).slice(0,4); }
  catch { return []; }
}
export default async function Page({params}:Props) {
  const {slug} = await params;const work = await getWorkDetail(slug);
  if (!work) notFound();
  if (work.slug !== slug) redirect("/works/"+work.slug);
  const [account,stats,reviews,related] = await Promise.all([getCurrentAccount(),getWorkStats(work.id),listReviews(work.id,null),relatedWorks(work.genres[0]?.slug,work.id)]);
  const active = account?.access.status === "active" && account.access.consents_current && Boolean(account.user.email_confirmed_at);
  const [record,settings] = active ? await Promise.all([getMyRecord(work.id),getMySettings()]) : [null,null];
  const recordDestination = active ? "/me/library" : await memberDestination("/works/"+work.slug);
  return <div className="page-container work-detail-page"><nav className="breadcrumb" aria-label="현재 위치"><Link href="/">홈</Link><span aria-hidden="true">/</span><Link href="/explore">작품 탐색</Link><span aria-hidden="true">/</span><span>{work.title}</span></nav>
    <section className="work-detail-hero"><div className="work-detail-cover"><WorkCover key={work.coverAssetId ?? "text"} title={work.title} assetId={work.coverAssetId} caption={work.genres.map(g=>g.name).join(" · ")}/>{work.coverAttribution ? <p className="cover-attribution">{work.coverAttribution}</p> : null}</div>
      <div className="work-detail-copy"><div className="work-detail-tags">{work.links.map(link=><PlatformBadge key={link.id} code={link.platformCode}>{link.platformName}{link.weekdays.length ? " · "+link.weekdays.map(day=>dayLabels[day]).join("/")+"요연재" : ""}</PlatformBadge>)}<span className="section-chip">{serialLabels[work.serialStatus]} · {ageLabels[work.ageRating]}</span></div><h1>{work.title}</h1>
        {work.aliases.length ? <p className="work-aliases">다른 이름: {work.aliases.join(" · ")}</p> : null}
        <dl className="work-creators">{work.creators.map(creator=><div key={creator.id+"-"+creator.role}><dt>{roleLabels[creator.role]}</dt><dd>{creator.name}</dd></div>)}</dl>
        <dl className="work-rating-summary"><div><dt>ToonShelf 평점</dt><dd><Star size={16} aria-hidden="true"/>{stats?.average == null ? "평가 없음" : stats.average.toFixed(2)}<small>{stats?.average == null ? "" : "/ 5.0"}</small></dd><p>{stats?.ratingCount ?? 0}명 참여</p></div><div><dt>기본 티어 평가</dt><dd>{stats?.tierCount ?? 0}<small>건</small></dd><p>개인 작품 평가 기준</p></div><div><dt>공개 리뷰</dt><dd>{reviews?.total ?? 0}<small>건</small></dd><p>현재 열람 가능한 리뷰</p></div><div><dt>작품 정보</dt><dd>{serialLabels[work.serialStatus]}</dd><p>{work.links.length}개 공식 읽는 곳</p></div></dl>
        <div className="active-filters">{work.genres.map(genre=><Link className="tag" key={genre.id} href={"/explore?genre="+genre.slug}>#{genre.name}</Link>)}</div>
        <div className="work-hero-actions">{work.links.map(link=><a key={link.id} className="button platform-action" data-platform={link.platformCode} href={link.url} target="_blank" rel="noopener noreferrer">{link.platformName}에서 보기 ↗</a>)}<a className="button button-secondary" href="#work-reviews"><MessageSquare size={15} aria-hidden="true"/>리뷰 읽기</a></div>
      </div>
    </section>
    <section id="my-reading-record" className="work-record-bar"><div className="work-record-heading"><h2><BookOpen size={20} aria-hidden="true"/>내 서재 기록실</h2><span className="section-chip">나의 독서 기록</span></div>{active && settings ? <RecordForm key={record?.version ?? "new"} work={work} record={record} defaults={{library:settings.default_library_visibility,evaluation:settings.default_evaluation_visibility}} layout="bar"/> : <div className="work-record-sign-in"><p>읽기 상태와 별점·기본 티어를 기록하고, 공개할 항목을 직접 선택하세요.</p><Link className="button button-primary" href={recordDestination}>로그인하고 기록하기</Link></div>}</section>
    <div className="work-content-layout"><div className="work-main"><section className="work-story-panel"><h2>작품 줄거리</h2><p className="work-description">{work.description || "작품 소개를 준비하고 있어요."}</p><details className="official-link-details"><summary>공식 플랫폼 정보와 확인일</summary><div className="official-links"><p>외부 플랫폼으로 이동해요. 플랫폼 분류는 제휴 표시가 아니에요.</p><div>{work.links.map(link=><article key={link.id}><div><h3><PlatformBadge code={link.platformCode}>{link.platformName}</PlatformBadge></h3><p>{serialLabels[link.serialStatus]} · {ageLabels[link.ageRating]}{link.weekdays.length ? " · "+link.weekdays.map(day=>dayLabels[day]).join("/") : ""}</p><p>정보 확인: {new Date(link.verifiedAt).toLocaleDateString("ko-KR",{timeZone:"UTC"})}</p></div><a className="text-link" href={link.url} target="_blank" rel="noopener noreferrer">공식 작품 페이지 ↗</a></article>)}</div></div></details></section>
      <section className="work-reviews" id="work-reviews"><div className="hub-section-heading"><h2>독자 서평 <span>{reviews?.total ?? 0}건</span></h2><span className="section-chip">스포일러 접힘</span></div><p className="field-hint">첫 게시 최신순 · 스포일러 본문은 상세에서 직접 펼쳐요.</p>{active ? <CreateReviewForm workId={work.id}/> : <Link className="text-link" href={recordDestination}>로그인하고 리뷰 작성하기</Link>}<ReviewList items={reviews?.items.slice(0,3) ?? []}/><Link className="review-more-link" href={"/works/"+work.slug+"/reviews"}>서평 전체 보기 →</Link></section>
      <div className="catalogue-detail-footer"><p>잘못된 정보나 사라진 링크를 발견했나요?</p><Link className="text-link" href={"/submissions/new?work="+work.id}>작품 정보 수정 제보</Link></div>
    </div><aside className="work-sidebar"><section className="work-tier-panel"><h2>독자 티어 분포 <span>{stats?.tierCount ?? 0}건</span></h2><p className="field-hint">공개한 기본 티어 기준</p>{stats ? <TierDistribution counts={stats.tiers} total={stats.tierCount}/> : <p>아직 공개 평가가 없어요.</p>}<p className="work-stat-note">공유 티어표의 배치는 중복 집계하지 않아요.</p></section><section className="work-related-panel"><div className="hub-section-heading"><h2>같은 장르의 웹툰</h2><Link className="text-link" href={work.genres[0] ? "/explore?genre="+work.genres[0].slug : "/explore"}>더 보기</Link></div><p className="field-hint">{work.genres[0] ? work.genres[0].name+" · 최근 등록순" : "작품 탐색에서 찾아보세요."}</p><div>{related.length ? related.map(item=><Link className="related-work" key={item.id} href={"/works/"+item.slug}><WorkCover title={item.title} assetId={item.coverAssetId}/><div><h3>{item.title}</h3><p>{item.creators.map(creator=>creator.name).join(" · ")}</p><span>{item.genres.map(genre=>genre.name).slice(0,2).join(" · ")}</span></div></Link>) : <p className="related-empty">함께 볼 공개 작품을 기다리고 있어요.</p>}</div></section><p className="work-evaluation-note">활성 회원의 공개 평가만 집계하며 외부 플랫폼 평점은 포함하지 않아요. 로그인한 화면에서는 차단 관계의 평가를 제외해요.</p></aside></div>
  </div>;
}
