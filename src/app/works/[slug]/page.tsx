import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { getPublicEnv } from "@/lib/env/public";
import { getWorkDetail } from "@/lib/catalogue/data";
import { ageLabels,dayLabels,roleLabels,serialLabels } from "@/lib/catalogue/model";
import { WorkCover } from "@/components/catalogue/work-cover";
import { getCurrentAccount,memberDestination } from "@/lib/auth/session";
import { getMySettings } from "@/lib/auth/data";
import { getMyRecord,getWorkStats } from "@/lib/library/data";
import { RecordForm } from "@/components/library/record-form";
import { listReviews } from "@/lib/reviews/data";
import { ReviewList } from "@/components/reviews/review-list";
import { CreateReviewForm } from "@/components/reviews/forms";
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
  const [account,stats,reviews] = await Promise.all([getCurrentAccount(),getWorkStats(work.id),listReviews(work.id,null)]);
  const active = account?.access.status === "active" && account.access.consents_current && Boolean(account.user.email_confirmed_at);
  const [record,settings] = active ? await Promise.all([getMyRecord(work.id),getMySettings()]) : [null,null];
  const recordDestination = active ? "/me/library" : await memberDestination("/works/"+work.slug);
  return <div className="page-container work-detail-page"><Link className="text-link" href="/explore">← 작품 찾기</Link>
    <section className="work-detail-hero"><div><WorkCover key={work.coverAssetId ?? "text"} title={work.title} assetId={work.coverAssetId} caption={work.genres.map(g=>g.name).join(" · ")}/>{work.coverAttribution ? <p className="cover-attribution">{work.coverAttribution}</p> : null}</div>
      <div className="work-detail-copy"><p className="eyebrow">{serialLabels[work.serialStatus]} · {ageLabels[work.ageRating]}</p><h1>{work.title}</h1>
        {work.aliases.length ? <p className="work-aliases">다른 이름: {work.aliases.join(" · ")}</p> : null}
        <dl className="work-creators">{work.creators.map(c=><div key={c.id+"-"+c.role}><dt>{roleLabels[c.role]}</dt><dd>{c.name}</dd></div>)}</dl>
        <div className="active-filters">{work.genres.map(g=><Link className="tag" key={g.id} href={"/explore?genre="+g.slug}>{g.name}</Link>)}</div>
        <p className="work-description">{work.description || "작품 소개를 준비하고 있어요."}</p>
        <div className="work-reading-note"><strong>내 서재에 기록</strong><p>읽기 상태와 별점·기본 티어를 기록하고, 공개 범위를 따로 고를 수 있어요.</p><a className="button button-secondary" href={active ? "#my-reading-record" : recordDestination}>{active ? "내 기록 편집" : "계정 확인하고 기록하기"}</a></div>
      </div>
    </section>
    <section className="official-links"><h2>공식 플랫폼에서 읽기</h2><p>외부 플랫폼으로 이동해요. 플랫폼명은 작품 분류이며 제휴 표시가 아니에요.</p>
      <div>{work.links.map(link=><article key={link.id}><div><h3>{link.platformName}</h3><p>{serialLabels[link.serialStatus]} · {ageLabels[link.ageRating]}{link.weekdays.length ? " · "+link.weekdays.map(d=>dayLabels[d]).join("/") : ""}</p><p>정보 확인: {new Date(link.verifiedAt).toLocaleDateString("ko-KR",{timeZone:"UTC"})}</p></div><a className="button button-secondary" href={link.url} target="_blank" rel="noopener noreferrer">공식 작품 페이지 ↗</a></article>)}</div>
    </section>
    <section className="work-evaluation-placeholder"><h2>ToonShelf 회원 평가</h2><p>활성 회원이 공개한 평가만 집계해요. 외부 플랫폼의 평점과 공유 티어표의 배치는 포함하지 않아요.</p>{stats ? <><p><strong>{stats.average === null ? "평가 없음" : stats.average.toFixed(2)+" / 5.0"}</strong> · 별점 {stats.ratingCount}명</p><p>기본 티어 {stats.tierCount}명 · {["S","A","B","C","D","F"].map(t=>t+" "+(stats.tiers[t] ?? 0)+"명").join(" · ")}</p></> : null}<p className="field-hint">차단 관계가 있는 회원의 평가는 현재 로그인한 화면의 집계에서 제외돼요.</p></section>
    {active && settings ? <section id="my-reading-record" className="reading-editor"><h2>나의 독서 기록</h2><RecordForm key={record?.version ?? "new"} work={work} record={record} defaults={{library:settings.default_library_visibility,evaluation:settings.default_evaluation_visibility}}/></section> : null}
    <section className="work-reviews"><h2>독자가 남긴 리뷰 · {reviews?.total ?? 0}개</h2>{active ? <CreateReviewForm workId={work.id}/> : <Link className="text-link" href={recordDestination}>계정 확인하고 리뷰 작성하기</Link>}<ReviewList items={reviews?.items.slice(0,3) ?? []}/><Link className="text-link" href={"/works/"+work.slug+"/reviews"}>공개 리뷰 모두 보기 →</Link></section>
    <div className="catalogue-detail-footer"><p>잘못된 정보나 사라진 링크를 발견했나요?</p><Link className="text-link" href={"/submissions/new?work="+work.id}>작품 정보 수정 제보</Link></div>
  </div>;
}
