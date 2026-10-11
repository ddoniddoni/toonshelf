import Link from "next/link";
import { readingLabels, readingSchema } from "@/lib/library/model";
import { ratingSummary, type TasteAnalysis } from "@/lib/discovery/analysis-model";
import { TierDistribution } from "@/components/ui/tier-distribution";

function Bars({rows}:{rows:{key:string;label:string;share:number;detail:string}[]}) {
 return <ul className="analysis-bars">{rows.map(row=><li key={row.key}>
  <div className="analysis-bar-caption"><span>{row.label}</span><span>{row.detail}</span></div>
  <div className="analysis-bar-track" aria-hidden="true"><span style={{width:`${row.share*100}%`}}/></div>
 </li>)}</ul>;
}
function Categories({title,items}:{title:string;items:TasteAnalysis["genres"]}) {
 return <section className="analysis-panel"><h2>{title}</h2>{items.length?<Bars rows={items.map(item=>({
  key:item.id??"unclassified",label:item.name,share:item.share,
  detail:`${(item.share*100).toFixed(1)}% · 환산 ${item.weight.toLocaleString("ko-KR",{maximumFractionDigits:2})}편 (포함 작품 ${item.workCount}편)`,
 }))}/>:<p>읽기 기록이 쌓이면 비중을 보여드려요.</p>}</section>;
}
export function TasteAnalysisView({result}:{result:TasteAnalysis}) {
 const rating=ratingSummary(result.ratings);
 const tierCount=Object.values(result.tiers).reduce((sum,n)=>sum+n,0);
 return <>
  <p>내 비공개 기록을 포함한 본인 전용 분석이에요. 현재 공개된 전체 이용가·12세·15세 작품만 집계해요.</p>
  {!result.totalCount && <div className="analysis-panel"><h2>아직 분석할 서재 기록이 없어요</h2><p>작품을 서재에 추가하고 읽기 상태와 평가를 남겨보세요.</p><Link href="/explore">작품 찾아보기 →</Link></div>}
  <dl className="analysis-summary">
   <div><dt>전체 기록</dt><dd>{result.totalCount}편</dd></div><div><dt>읽은 작품</dt><dd>{result.readCount}편</dd></div>
   <div><dt>완독</dt><dd>{result.statuses.completed??0}편</dd></div><div><dt>내 평균 별점</dt><dd>{rating.average?.toFixed(2)??"—"}<small>{rating.count}편 평가</small></dd></div>
  </dl>
  <p>읽은 작품은 읽는 중·완독·하차를 포함하고 읽을 예정은 제외해요. 별점과 기본 티어도 이 작품들을 기준으로 집계해요.</p>
  {result.totalCount>0 && !result.readCount && <p role="status">현재는 읽을 예정인 작품만 있어요. 읽기 상태를 바꾸면 취향 비중을 볼 수 있어요.</p>}
  <div className="analysis-grid">
   <Categories title="장르 비중" items={result.genres}/><Categories title="작품 제공 플랫폼 비중" items={result.platforms}/>
  </div>
  <details className="analysis-panel"><summary>비중은 어떻게 계산하나요?</summary><p>장르가 k개인 작품은 각 장르에 1/k편씩 나눠요. 장르가 없으면 미분류 1편으로 계산해요. 플랫폼도 작품별로 중복을 합친 후 같은 방식으로 나눠요. 각 비중의 분모는 읽은 작품 수예요. 반올림으로 표시 합계가 조금 다를 수 있어요.</p><p>플랫폼은 현재 확인된 공식 제공처 기준이에요. 내가 실제로 읽은 서비스나 결제한 플랫폼을 뜻하지 않아요. 비활성 장르·플랫폼과 확인되지 않은 링크는 제외해요.</p></details>
  <div className="analysis-grid">
   <section className="analysis-panel"><h2>읽기 상태</h2><Bars rows={readingSchema.options.map(status=>({key:status,label:readingLabels[status],share:result.totalCount?(result.statuses[status]??0)/result.totalCount:0,detail:`${result.statuses[status]??0}편`}))}/></section>
   <section className="analysis-panel"><h2>별점 분포</h2>{rating.count?<Bars rows={Array.from({length:10},(_,index)=>{
    const steps=String(index+1) as keyof TasteAnalysis["ratings"];const n=result.ratings[steps]??0;
    return {key:steps,label:`${(index+1)/2}점`,share:n/rating.count,detail:`${n}편`};
   })}/>:<p>아직 별점을 남긴 작품이 없어요.</p>}<p>별점 미평가 {result.readCount-rating.count}편</p></section>
   <section className="analysis-panel"><h2>기본 티어 분포</h2>{tierCount?<TierDistribution counts={result.tiers} total={tierCount}/>:<p>아직 기본 티어를 남긴 작품이 없어요.</p>}<p>기본 티어 미평가 {result.readCount-tierCount}편 · 티어표 배치는 중복 집계하지 않아요.</p></section>
  </div>
  <p className="analysis-timestamp">계산 시각 <time dateTime={result.computedAt}>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Seoul"}).format(new Date(result.computedAt))}</time> (한국 시간)</p>
 </>;
}
