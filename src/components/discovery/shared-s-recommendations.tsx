import Link from "next/link";
import { WorkCard } from "@/components/catalogue/work-card";
import type { SharedSRecommendations } from "@/lib/discovery/shared-s-model";

export function SharedSRecommendationList({result}:{result:SharedSRecommendations}) {
 return <>
  <p className="field-hint">이 작품을 S로 평가한 독자들의 다른 공개 평가를 바탕으로 골랐어요.</p>
  {result.items.length ? <div className="shared-s-grid">{result.items.map(item=><div className="shared-s-item" key={item.work.id}><WorkCard work={item.work}/><p className="shared-s-reason">공동 평가 {item.sampleCount}명 중 <strong>{item.sharedSCount}명이 이 작품도 S</strong></p></div>)}</div>
   : <div className="shared-s-empty"><p>아직 추천 기준을 충족한 작품이 없어요.</p><p className="field-hint">두 작품을 공개 평가한 독자 5명 이상, 두 작품 모두 S인 독자 3명 이상이 필요해요.</p><Link className="text-link" href="/explore">작품 탐색에서 찾아보기 →</Link></div>}
  <p className="field-hint">계산 시각 <time dateTime={result.computedAt}>{new Date(result.computedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time> · 한국 시간</p>
  <details className="shared-s-method"><summary>추천 기준 알아보기</summary><p>기준 작품을 공개 기본 티어 S로 평가한 활성 독자 중, 후보 작품에도 공개 기본 티어를 남긴 사람을 공동 평가자로 세요. 이 중 후보도 S인 비율에 표본 수 ÷ (표본 수 + 10)을 곱해 정렬해요. 동점은 공동 평가자 수, 공동 S 수, 작품 식별자 순이에요.</p><p>별점이나 공유 티어표 배치는 중복 집계하지 않아요. 공개를 철회한 평가, 접근할 수 없는 작품, 로그인한 나와 차단 관계인 독자의 평가는 제외해요. 표시한 수는 현재 공동 평가 표본이며 전체 독자의 선호 확률은 아니에요.</p></details>
 </>;
}
