import { readingLabels,type ReadingStats } from "@/lib/library/model";
export function ReadingStatistics({stats,isPublic=false}:{stats:ReadingStats;isPublic?:boolean}) {
 const ratingCount = Object.values(stats.ratings).reduce((n,v)=>n+v,0);const tierCount = Object.values(stats.tiers).reduce((n,v)=>n+v,0);
 return <section className="reading-statistics" aria-label={isPublic ? "공개 기록 통계" : "내 독서 통계"}><h2>{isPublic ? "공개 기록으로 보는 취향" : "나의 독서 기록"}</h2><p className="field-hint">{isPublic ? "공개한 상태와 공개한 평가를 각각 집계해요. 비공개 기록은 포함하지 않아요." : "내 공개·비공개 기록을 함께 집계해요."} 현재 공개 가능한 작품만 포함하며, 읽은 작품 수는 나중에 볼 작품을 제외해요.</p>
  <dl className="reading-stat-grid"><div><dt>읽은 작품</dt><dd>{stats.readCount}편</dd></div>{Object.entries(readingLabels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{stats.statuses[key] ?? 0}편</dd></div>)}</dl>
  <div className="reading-distributions"><div><h3>별점 분포 · {ratingCount}건</h3><p>{Object.entries(stats.ratings).sort(([a],[b])=>Number(a)-Number(b)).map(([steps,count])=>`${(Number(steps)/2).toFixed(1)}점 ${count}건`).join(" · ") || "평가 없음"}</p></div><div><h3>기본 티어 · {tierCount}건</h3><p>{["S","A","B","C","D","F"].map(t=>`${t} ${stats.tiers[t] ?? 0}건`).join(" · ")}</p></div><div><h3>읽은 작품의 장르 · {stats.readCount}편 기준</h3><p>{stats.genres.map(g=>`${g.name} ${(g.share*100).toFixed(1)}%`).join(" · ") || "독서 기록 없음"}</p><p className="field-hint">한 작품에 장르가 여러 개면 비중을 나눠 집계해요.</p></div></div>
 </section>;
}
