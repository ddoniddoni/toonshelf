import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, Layers3, PencilLine, Star } from "lucide-react";
import { WorkCard } from "@/components/catalogue/work-card";
import { WorkCover } from "@/components/catalogue/work-cover";
import { ReviewList } from "@/components/reviews/review-list";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicEnv } from "@/lib/env/public";
import { searchWorks } from "@/lib/catalogue/data";
import { parseFilters, dayLabels, type WorkCard as Card } from "@/lib/catalogue/model";
import { listReviews } from "@/lib/reviews/data";
import type { ReviewCard } from "@/lib/reviews/model";

export const dynamic = "force-dynamic";

async function loadHome() {
  const empty: { works: Card[]; reviews: ReviewCard[]; reviewWork: Card | null; unavailable: boolean } = { works: [], reviews: [], reviewWork: null, unavailable: false };
  if (!getPublicEnv().supabase) return empty;
  try {
    const catalogue = await searchWorks(parseFilters({}), undefined, 6);
    const first = catalogue.items[0] ?? null;
    let reviews: ReviewCard[] = [];
    if (first) {
      try { reviews = (await listReviews(first.id, null, 1))?.items.slice(0, 2) ?? []; }
      catch { /* The catalogue remains available when reviews cannot load. */ }
    }
    return { ...empty, works: catalogue.items, reviews, reviewWork: first };
  } catch { return { ...empty, unavailable: true }; }
}

const tierGuides = [
  { label: "MY TIER", title: "나만의 기준으로 고른 S급 작품", description: "개인 별점과 별도로, 공유하고 싶은 작품의 티어표를 만들어요.", href: "/tiers", action: "티어 편집기 미리 보기", Icon: Layers3 },
  { label: "READING ARCHIVE", title: "끝까지 읽은 이야기를 한곳에", description: "완독한 작품을 모아 보고, 오래 남을 감상을 기록해 보세요.", href: "/me/library?status=completed", action: "완독한 내 작품 보기", Icon: BookOpen },
  { label: "NEXT STORY", title: "다음에 읽을 이야기를 모아요", description: "여러 플랫폼에서 찾은 작품을 나중에 볼 목록에 담아 두세요.", href: "/me/library?status=planned", action: "나중에 볼 작품 보기", Icon: Star },
];

export default async function HomePage() {
  const home = await loadHome();
  const featured = home.works[0];
  return <div className="page-container home-hub">
    <section className="home-banner" aria-labelledby="home-title">
      <div className="home-banner-copy">
        <div><p className="banner-kicker"><span>WEBTOON ARCHIVE</span><small>읽고, 기록하고, 취향을 나누는 서재</small></p>
          <h1 id="home-title">읽은 이야기마다,<br/><span>나의 취향이 쌓인다.</span></h1>
          <p>네이버웹툰·카카오웹툰·리디 등 여러 플랫폼의 작품을 한곳에서 찾고,<br/>별점과 리뷰로 오래 남을 이야기를 모아 보세요.</p></div>
        <div className="home-banner-actions"><Link className="button button-primary" href="/explore">작품 찾아보기 <ArrowRight size={16} aria-hidden="true"/></Link><Link href="/me/library"><span className="banner-status-dot"/> 내 서재에서 기록하기</Link></div>
      </div>
      <div className="home-banner-visual"><div className="home-banner-picture" aria-hidden="true">{featured?.coverAssetId ? <WorkCover title={featured.title} assetId={featured.coverAssetId}/> : <span className="banner-monogram">T</span>}</div><div className="home-banner-caption"><span>{featured ? "최근 등록된 이야기" : "MY WEBTOON ARCHIVE"}</span><Link href={featured ? "/works/"+featured.slug : "/explore"}>{featured?.title ?? "여러 플랫폼의 이야기를 나의 서재에"}</Link><small>{featured ? featured.genres.map(g=>g.name).join(" · ") : "작품 정보와 공식 읽는 곳을 함께 확인해요."}</small></div></div>
    </section>
    <nav id="weekdays" className="day-navigation" aria-label="요일별 웹툰"><div>{dayLabels.map((day,index)=><Link key={day} href={"/explore?day="+index}>{day}</Link>)}<span className="day-divider"/><Link href="/explore?status=completed">완결</Link><Link href="/explore?sort=latest">신작 <small>N</small></Link></div><div className="day-controls"><Link href="/explore?sort=latest">최근 등록순 <ChevronDown size={12} aria-hidden="true"/></Link><Link href="/explore">전체 플랫폼 <ChevronDown size={12} aria-hidden="true"/></Link></div></nav>
    <section className="home-section" aria-labelledby="recent-works"><div className="hub-section-heading"><div><h2 id="recent-works">새로 등록된 웹툰 <span className="section-chip">최근 등록</span></h2><p>공식 출처와 함께 등록된 작품을 만나 보세요.</p></div><Link className="text-link" href="/explore">전체 작품 <ArrowRight size={14} aria-hidden="true"/></Link></div>
      {home.works.length ? <div className="work-grid home-work-grid">{home.works.map(work=><WorkCard key={work.id} work={work}/>)}</div> : <EmptyState title={home.unavailable ? "작품 목록을 불러오지 못했어요" : "첫 이야기를 기다리고 있어요"} description={home.unavailable ? "작품 탐색에서 다시 확인해 주세요." : "공개된 작품이 등록되면 여기에 표시돼요. 알고 있는 작품을 공식 출처와 함께 제보해 주세요."} action={<Link className="button button-secondary" href={home.unavailable ? "/explore" : "/submissions/new"}>{home.unavailable ? "작품 탐색으로 이동" : "작품 제보하기"}</Link>}/>}</section>
    <section className="home-section" aria-labelledby="home-tiers"><div className="hub-section-heading"><div><h2 id="home-tiers">독자 큐레이션 티어리스트 <span className="section-chip">준비 중</span></h2><p>공유 티어리스트 기능은 준비 중이에요. 내 기록부터 모아 보세요.</p></div><Link className="text-link" href="/tiers">편집기 미리 보기 <ArrowRight size={14} aria-hidden="true"/></Link></div><div className="home-tier-grid">{tierGuides.map(({label,title,description,href,action,Icon})=><article className="home-tier-card" key={label}><div className="tier-cover-strip" aria-hidden="true">{[0,1,2,3].map(n=><div key={n}><BookOpen size={18}/></div>)}</div><span className="tier-guide-label">{label}</span><h3>{title}</h3><p>{description}</p><div className="tier-guide-footer"><Icon size={15} aria-hidden="true"/><Link href={href}>{action} <ArrowRight size={13} aria-hidden="true"/></Link></div></article>)}</div></section>
    <section className="home-section home-reviews-section" aria-labelledby="home-reviews"><div className="hub-section-heading"><div><h2 id="home-reviews">독자 리뷰 &amp; 정주행 한줄평 <span className="section-chip">REVIEW</span></h2><p>{home.reviewWork ? home.reviewWork.title+"에 남긴 공개 리뷰예요. 스포일러는 상세에서 직접 펼쳐요." : "읽은 기준 회차와 스포일러 표시를 함께 남겨 보세요."}</p></div><Link className="button button-secondary" href="/me/reviews"><PencilLine size={16} aria-hidden="true"/>내 리뷰 남기기</Link></div><ReviewList items={home.reviews} variant="feed"/></section>
  </div>;
}
