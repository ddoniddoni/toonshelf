import Link from "next/link";
import { WorkCard } from "@/components/catalogue/work-card";
import type { PersonalRecommendations } from "@/lib/discovery/personal-model";

export function PersonalRecommendationList({result}:{result:PersonalRecommendations}) {
 return <>
  <p className="field-hint">현재 비교에 사용할 수 있는 내 평가 {result.ownEvaluationCount}편 · 내 서재에 저장한 작품은 제외해요.</p>
  {result.mode!=="collaborative" ? <div className="shared-s-empty"><p>{result.reason==="insufficient_evaluations" ? "취향을 비교하려면 평가한 작품이 5편 이상 필요해요." : "아직 개인 추천 기준을 충족한 작품이 없어요."}</p><Link className="text-link" href="/me/library" prefetch={false}>내 서재에서 평가 남기기 →</Link></div> : null}
  {result.mode==="collaborative" ? <><h2>비슷한 취향의 독자들이 평가한 작품</h2><div className="shared-s-grid">{result.items.map(item=><div className="shared-s-item" key={item.work.id}>
   <WorkCard work={item.work}/><p className="shared-s-reason"><strong>취향을 비교한 독자 {item.sampleCount}명</strong>의 공개 평가를 바탕으로 추천해요.</p>
   <p className="field-hint">독자별 공통 평가 {item.minCommonCount===item.maxCommonCount ? item.minCommonCount : `${item.minCommonCount}~${item.maxCommonCount}`}편 · 가중 평가 점수 {(item.score*100).toFixed(1)}/100</p>
  </div>)}</div></> : result.mode==="genre" ? <><h2>장르 기반 추천</h2><p>관심 장르에 맞는 작품을 최근 등록순으로 골랐어요. 취향 유사도로 계산한 추천과는 별개예요.</p><div className="shared-s-grid">{result.items.map(item=><div className="shared-s-item" key={item.work.id}><WorkCard work={item.work}/><p className="shared-s-reason">관심 장르: {item.genres.join(" · ")}</p></div>)}</div></> : <p>현재 보여드릴 추천 작품이 없어요. 관심 장르를 설정하거나 작품 탐색에서 첫 기록을 시작해 보세요.</p>}
  <div className="personal-recommendation-links"><Link className="text-link" href="/explore">작품 탐색 →</Link><Link className="text-link" href="/settings/privacy" prefetch={false}>관심 장르 설정 →</Link></div>
  <p className="field-hint">계산 시각 <time dateTime={result.computedAt}>{new Date(result.computedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time> · 한국 시간</p>
  <details className="shared-s-method"><summary>개인 추천은 어떻게 계산하나요?</summary>
   <p>나와 공통 평가가 5편 이상인 독자의 유사도에 공통 편수 ÷ (공통 편수 + 10)을 곱해 최대 50명의 평가를 반영해요. 티어를 우선 비교하고 공통 티어가 없으면 별점을 비교해요. 후보 작품은 공개 티어를 우선하며, 티어가 없으면 공개 별점을 사용해요.</p>
   <p>작품별 이웃 평가 3명 이상, 가중 평가 점수 60/100 이상인 최대 12편을 점수순으로 보여줘요. 동점이면 평가자 수와 작품 식별자 순이에요. 이 점수는 내가 좋아할 확률이 아니에요.</p>
   <p>최근 평가한 공개 작품 최대 100편에서 작품별 공개 평가 최대 200건을 먼저 찾고, 공통 작품이 많은 후보 최대 200명을 비교해요. 전체 회원 중 가장 비슷한 사람을 모두 찾는 방식은 아니에요.</p>
   <p>내 비공개 평가는 나에게만 제공되는 계산에 포함해요. 다른 사람의 비공개 평가, 추천 참여를 끈 독자, 차단·비활성 계정과 접근할 수 없는 작품은 제외해요. 결과는 조회할 때마다 계산해요.</p>
  </details>
 </>;
}
