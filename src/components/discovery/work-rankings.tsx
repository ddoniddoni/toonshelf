import Link from "next/link";
import { WorkCard } from "@/components/catalogue/work-card";
import { audienceLabels,rankingsUrl,type Rankings,type RankingFilters } from "@/lib/discovery/rankings-model";

export function RankingFiltersForm({filters,options}:{filters:RankingFilters;options:{platforms:{code:string;name:string}[];genres:{slug:string;name:string}[]}|null}) {
 return <form action="/rankings" className="ranking-filters">
  <input type="hidden" name="section" value={filters.section}/>
  <label>평가 대상<select name="audience" defaultValue={filters.audience}>{Object.entries(audienceLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
  <label>플랫폼<select name="platform" defaultValue={filters.platform??""}><option value="">전체 플랫폼</option>{options?.platforms.map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
  <label>장르<select name="genre" defaultValue={filters.genre??""}><option value="">전체 장르</option>{options?.genres.map(g=><option key={g.slug} value={g.slug}>{g.name}</option>)}</select></label>
  <button className="button button-primary" type="submit">조건 적용</button><Link href="/rankings" prefetch={false}>초기화</Link>
 </form>;
}
export function WorkRankings({result}:{result:Rankings}) {
 const ranked=result.section==="ranked";
 return <>
  <nav className="ranking-sections" aria-label="순위 목록 선택">
   <Link href={rankingsUrl(result,{section:"ranked",page:1})} prefetch={false} aria-current={ranked?"page":undefined}>작품 순위</Link>
   <Link href={rankingsUrl(result,{section:"insufficient",page:1})} prefetch={false} aria-current={!ranked?"page":undefined}>표본 부족 작품</Link>
  </nav>
  <h2>{ranked?"작품 순위":"표본 부족 작품"} · {result.total.toLocaleString("ko-KR")}편</h2>
  <p>{audienceLabels[result.audience]} 기준{ranked?" · 표시된 별점은 실제 평균이에요.":" · 공개 평가 5건 미만은 평균과 순위를 표시하지 않아요."}</p>
  {result.items.length?<ol className="ranking-grid" start={(result.page-1)*20+1} aria-label={ranked?"작품 순위":"표본 부족 작품 목록"}>{result.items.map(item=><li key={item.work.id}>
   <div className="ranking-entry-heading"><strong>{item.rank===null?"표본 부족":`${item.rank}위`}</strong><span>공개 평가 {item.sampleCount}건{item.average===null?"":` · 평균 ${item.average.toFixed(2)}점`}</span></div>
   <WorkCard work={item.work}/>
  </li>)}</ol>:<div className="ranking-empty" role="status"><h3>{result.total?"이 페이지에는 작품이 없어요":ranked?"아직 순위를 매길 표본이 부족해요":"이 조건의 표본 부족 작품이 없어요"}</h3><p>조건을 바꾸거나 첫 페이지에서 다시 살펴보세요. 공개 평가가 쌓이면 집계에 반영돼요.</p><Link href={rankingsUrl(result,{page:1})} prefetch={false}>첫 페이지</Link></div>}
  <nav className="catalogue-pagination" aria-label="순위 페이지">
   {result.page>1?<Link href={rankingsUrl(result,{page:result.page-1})} prefetch={false}>이전 페이지</Link>:null}
   <span>{result.page}페이지</span>{result.hasNext?<Link href={rankingsUrl(result,{page:result.page+1})} prefetch={false}>다음 페이지</Link>:null}
  </nav>
  {result.page===1000 && result.total>20000?<p>최대 1,000페이지까지 볼 수 있어요. 장르나 플랫폼으로 범위를 좁혀 주세요.</p>:null}
  <p className="ranking-computed-at">집계 시각 <time dateTime={result.computedAt}>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Seoul"}).format(new Date(result.computedAt))}</time> (한국 시간)</p>
 </>;
}
export function RankingExplanation() {
 return <details className="ranking-explanation"><summary>순위와 표본은 어떻게 계산하나요?</summary>
  <p>작품별 공개 별점 5건 이상만 순위에 포함해요. 평균 별점 R, 평가 수 v, 사이트 전체 유효 공개 평가의 평균 C를 이용해 (v × R + 20 × C) ÷ (v + 20) 순으로 정렬해요. 동점이면 평가 수, 작품 ID 순이에요. 화면의 평균은 보정하지 않은 R이에요.</p>
  <p>C는 같은 조회 시점에 장르·플랫폼·평가 대상 필터를 적용하기 전의 전체 공개 평가 기준이에요. 현재 계정·작품 공개 상태와 양방향 차단을 적용하므로 로그인한 사람에 따라 집계가 달라질 수 있어요.</p>
  <p>완독자는 공개 서재에 완독으로 기록한 회원이에요. 공개 독서 기록 30편 이상 조건은 현재 공개 가능한 작품의 공개 서재 기록만 세고 읽을 예정은 제외해요. 비공개 서재 상태로 자격을 추정하지 않아요. 전체 공개 평가는 서재 공개 여부와 별개로 공개한 별점만 사용해요.</p>
  <p>별점은 회원별 작품당 한 번만 세며 여러 플랫폼이나 티어표 배치를 중복 집계하지 않아요. 순위는 품질의 객관적 판정이 아니에요. 페이지를 이동할 때마다 다시 계산하므로 기록이 바뀌면 순서나 표본도 바뀔 수 있어요.</p>
 </details>;
}
