import Link from "next/link";
import { ArrowRight, Bookmark, Layers3, LockKeyhole, Search, Star } from "lucide-react";
import { TypographyCover } from "@/components/work/typography-cover";

export default function HomePage() {
  return <div className="page-container home-page">
    <section className="hero" aria-labelledby="home-title">
      <div className="hero-copy">
        <p className="eyebrow"><span className="tiny-book" aria-hidden="true" />나의 웹툰, 하나의 서재</p>
        <h1 id="home-title">읽은 이야기마다,<br /><span>나의 취향이 쌓인다.</span></h1>
        <p className="hero-description">여러 플랫폼에서 만난 웹툰을 한곳에.<br />좋았던 순간을 기록하고, 나만의 순서로 모아 보세요.</p>
        <div className="hero-actions"><Link className="button button-primary" href="/explore">서재 둘러보기<ArrowRight size={18} aria-hidden="true" /></Link><a className="text-link" href="#about">어떤 서재인가요?</a></div>
        <p className="hero-note"><span className="status-dot" aria-hidden="true" />지금은 미리 보기예요. 기록과 공유 기능을 준비하고 있어요.</p>
      </div>
      <div className="shelf-art" role="img" aria-label="읽고, 기록하고, 나누는 취향을 표현한 세 권의 책 일러스트">
        <div className="shelf-annotation" aria-hidden="true">취향이 머무는 자리 <span>↙</span></div>
        <div className="shelf-books" aria-hidden="true">
          <div className="art-book art-book-one"><TypographyCover title="읽다." caption="마음에 남는 이야기" tone="iris" /></div>
          <div className="art-book art-book-two"><TypographyCover title="기록하다." caption="나만의 감상과 별점" tone="mint" /></div>
          <div className="art-book art-book-three"><TypographyCover title="나누다." caption="서로 다른 취향의 발견" tone="peach" /></div>
        </div>
        <div className="shelf-base" aria-hidden="true" /><div className="shelf-label" aria-hidden="true"><span>MY TASTE, MY SHELF</span><Bookmark size={18} /></div>
      </div>
    </section>
    <section className="about-section" id="about" aria-labelledby="about-title">
      <div className="section-heading"><div><p className="eyebrow">취향을 모으는 세 가지 방법</p><h2 id="about-title">다 읽고 나서도, 이야기는 계속.</h2></div><p>읽는 곳은 달라도<br />기록은 흩어지지 않도록.</p></div>
      <div className="feature-grid">
        <article className="feature"><span className="feature-icon icon-iris"><Search size={23} aria-hidden="true" /></span><h3>흩어진 작품을 한곳에</h3><p>플랫폼마다 흩어진 작품을 찾고,<br />다음에 읽을 이야기까지 모아요.</p><span className="feature-caption">발견하는 즐거움</span></article>
        <article className="feature"><span className="feature-icon icon-mint"><Star size={23} aria-hidden="true" /></span><h3>평가는 내 기준으로</h3><p>별점과 티어, 짧은 감상까지.<br />남의 순위보다 나의 취향을 남겨요.</p><span className="feature-caption">기록하는 즐거움</span></article>
        <article className="feature"><span className="feature-icon icon-peach"><Layers3 size={23} aria-hidden="true" /></span><h3>취향이 닿는 사람들과</h3><p>나만의 티어리스트를 만들고,<br />다른 독자의 새로운 관점을 만나요.</p><span className="feature-caption">나누는 즐거움</span></article>
      </div>
    </section>
    <aside className="privacy-strip"><span className="privacy-icon"><LockKeyhole size={21} aria-hidden="true" /></span><div><h2>공유는, 내가 원할 때.</h2><p>내 서재와 평가는 비공개로 시작해요. 공개할 기록은 직접 선택하세요.</p></div><span className="privacy-tag">나를 위한 서재</span></aside>
  </div>;
}
