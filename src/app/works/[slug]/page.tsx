import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getPublicEnv } from "@/lib/env/public";
import { getWorkDetail } from "@/lib/catalogue/data";
import { ageLabels,dayLabels,roleLabels,serialLabels } from "@/lib/catalogue/model";
import { WorkCover } from "@/components/catalogue/work-cover";
export const dynamic = "force-dynamic";
type Props = {params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props) {
  const {slug} = await params;const work = await getWorkDetail(slug);
  if (!work) return {title:"작품을 찾을 수 없어요",robots:{index:false,follow:false}};
  return {title:work.title,description:work.description.slice(0,160) || work.title+"의 작품 정보와 공식 플랫폼 링크",
    alternates:{canonical:new URL("/works/"+work.slug,getPublicEnv().siteUrl).href}};
}
export default async function Page({params}:Props) {
  const {slug} = await params;const work = await getWorkDetail(slug);
  if (!work) notFound();
  if (work.slug !== slug) redirect("/works/"+work.slug);
  return <div className="page-container work-detail-page"><Link className="text-link" href="/explore">← 작품 찾기</Link>
    <section className="work-detail-hero"><div><WorkCover key={work.coverAssetId ?? "text"} title={work.title} assetId={work.coverAssetId} caption={work.genres.map(g=>g.name).join(" · ")}/>{work.coverAttribution ? <p className="cover-attribution">{work.coverAttribution}</p> : null}</div>
      <div className="work-detail-copy"><p className="eyebrow">{serialLabels[work.serialStatus]} · {ageLabels[work.ageRating]}</p><h1>{work.title}</h1>
        {work.aliases.length ? <p className="work-aliases">다른 이름: {work.aliases.join(" · ")}</p> : null}
        <dl className="work-creators">{work.creators.map(c=><div key={c.id+"-"+c.role}><dt>{roleLabels[c.role]}</dt><dd>{c.name}</dd></div>)}</dl>
        <div className="active-filters">{work.genres.map(g=><Link className="tag" key={g.id} href={"/explore?genre="+g.slug}>{g.name}</Link>)}</div>
        <p className="work-description">{work.description || "작품 소개를 준비하고 있어요."}</p>
        <div className="work-reading-note"><strong>내 서재에 기록</strong><p>읽기 상태·별점·리뷰 기능을 준비하고 있어요.</p><button className="button button-secondary" disabled>서재 기록 준비 중</button></div>
      </div>
    </section>
    <section className="official-links"><h2>공식 플랫폼에서 읽기</h2><p>외부 플랫폼으로 이동해요. 플랫폼명은 작품 분류이며 제휴 표시가 아니에요.</p>
      <div>{work.links.map(link=><article key={link.id}><div><h3>{link.platformName}</h3><p>{serialLabels[link.serialStatus]} · {ageLabels[link.ageRating]}{link.weekdays.length ? " · "+link.weekdays.map(d=>dayLabels[d]).join("/") : ""}</p><p>정보 확인: {new Date(link.verifiedAt).toLocaleDateString("ko-KR",{timeZone:"UTC"})}</p></div><a className="button button-secondary" href={link.url} target="_blank" rel="noopener noreferrer">공식 작품 페이지 ↗</a></article>)}</div>
    </section>
    <section className="work-evaluation-placeholder"><h2>ToonShelf 회원 평가와 리뷰</h2><p>평가·리뷰 기능을 준비하고 있어요. 외부 플랫폼의 평점은 가져오지 않아요.</p></section>
    <div className="catalogue-detail-footer"><p>잘못된 정보나 사라진 링크를 발견했나요?</p><Link className="text-link" href={"/submissions/new?work="+work.id}>작품 정보 수정 제보</Link></div>
  </div>;
}
