import Link from "next/link";
import { comparisonLabels,comparisonSampleLabel,comparisonSections,comparisonUrl,type TasteComparison } from "@/lib/discovery/comparison-model";

export function TasteComparisonResult({comparison:c}:{comparison:TasteComparison}) {
 const counts={all:c.commonCount,common_s:c.commonSCount,different:c.differentCount};
 return <>
  <header className="comparison-heading"><p className="eyebrow">TASTE COMPARISON</p><h1>{c.profile.name}님과 나의 취향</h1><p>내 평가와 @{c.profile.username}님의 공개 평가를 비교해요.</p></header>
  <section className="comparison-summary" aria-labelledby="comparison-score-title">
   <div><h2 id="comparison-score-title">취향 유사도</h2><p className="comparison-score">{c.similarity===null ? "표본 부족" : <>{c.similarity}<span> / 100</span></>}</p>
    {c.similarity!==null ? <meter min={0} max={100} value={c.similarity} aria-label="취향 유사도">{c.similarity}점</meter> : <p>점수는 비교 가능한 공통 작품이 5편 이상일 때 보여요. 현재 {c.commonCount}편이에요.</p>}
   </div>
   <div><p className="comparison-sample">{comparisonSampleLabel(c.commonCount)}</p><dl className="comparison-counts"><div><dt>공통 작품</dt><dd>{c.commonCount}편</dd></div><div><dt>기본 티어 기준</dt><dd>{c.tierCount}편</dd></div><div><dt>별점 기준</dt><dd>{c.ratingCount}편</dd></div></dl><p className="field-hint">작품 수에 따른 안내이며 취향이나 정확도를 보장하는 수치는 아니에요.</p></div>
  </section>
  <p className="field-hint">내 비공개 평가도 포함될 수 있어요. 이 결과는 나에게만 표시되며 상대방에게 전달되지 않아요.</p>
  <nav className="comparison-tabs" aria-label="비교 작품 분류">{comparisonSections.map(section=><Link key={section} href={comparisonUrl(c.profile.username,section)} prefetch={false} aria-current={c.section===section ? "page" : undefined}>{comparisonLabels[section]} <span>{counts[section]}</span></Link>)}</nav>
  <section aria-labelledby="comparison-list-title"><h2 id="comparison-list-title">{comparisonLabels[c.section]}</h2>
   {c.section==="different" ? <p className="field-hint">정규화한 평가 차이가 0.4 이상인 작품을 차이가 큰 순서로 보여요.</p> : null}
   <div className="comparison-list">{c.items.map(item=><article key={item.work.id} className="comparison-work"><div><h3><Link href={"/works/"+item.work.slug} prefetch={false}>{item.work.title}</Link></h3><p className="field-hint">{item.signal==="tier" ? "기본 티어 기준" : "별점 기준"}</p></div>
    <dl><div><dt>나</dt><dd>{item.signal==="tier" ? item.mine : (item.mine/2).toFixed(1)+"점"}</dd></div><div><dt>{c.profile.name}</dt><dd>{item.signal==="tier" ? item.other : (item.other/2).toFixed(1)+"점"}</dd></div></dl>
   </article>)}</div>
   {!c.items.length ? <div className="review-body-gate"><p>{c.page>1 ? "이 페이지에 표시할 작품이 없어요." : c.section==="common_s" ? "아직 함께 S로 평가한 작품이 없어요." : c.section==="different" ? "현재 기준으로 평가 차이가 큰 작품이 없어요." : "아직 같은 기준으로 비교할 수 있는 공통 작품이 없어요."}</p>{c.page>1 ? <Link href={comparisonUrl(c.profile.username,c.section)} prefetch={false}>첫 페이지로</Link> : <Link href="/me/library">내 서재에서 평가 남기기</Link>}</div> : null}
   <nav className="library-pagination" aria-label="비교 작품 페이지">{c.page>1 ? <Link href={comparisonUrl(c.profile.username,c.section,c.page-1)} prefetch={false}>이전</Link> : null}{c.hasNext && c.page<1000 ? <Link href={comparisonUrl(c.profile.username,c.section,c.page+1)} prefetch={false}>다음</Link> : null}</nav>
  </section>
  <details className="comparison-method"><summary>어떻게 비교하나요?</summary><p>둘 다 기본 티어가 있으면 티어를 우선해요. 그 외에는 둘 다 별점이 있는 작품을 비교해요. 한 사람은 티어만, 다른 사람은 별점만 남겼다면 제외해요.</p><p>티어는 S=1, A=0.8, B=0.6, C=0.4, D=0.2, F=0으로, 별점은 0.5점=0부터 5점=1까지 바꿔요. 작품별 차이의 평균을 1에서 뺀 뒤 100을 곱하고 정수로 반올림해요.</p><p>5편 미만은 점수 없음, 5~9편은 적은 표본, 10~29편은 보통 표본, 30편 이상은 많은 표본이에요. 0점은 비교 결과이고, 점수 없음은 표본 부족이에요.</p><p>현재 공개 가능한 작품만 포함해요. 상대의 비공개 평가, 메모, 독서 상태는 표시하지 않아요. 평가·공개 설정·차단 상태가 바뀌면 다시 조회한 결과와 페이지 구성이 달라질 수 있어요.</p></details>
 </>;
}
