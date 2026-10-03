import Link from "next/link";
import type { CatalogueRating,WorkCard as Card } from "@/lib/catalogue/model";
import { serialLabels } from "@/lib/catalogue/model";
import { WorkCover } from "./work-cover";
import { PlatformBadge } from "@/components/ui/catalogue-badges";
export function WorkCard({work,rating}:{work:Card;rating?:CatalogueRating}) {
  return <article className="work-card"><Link href={"/works/"+work.slug} className="work-card-link">
    <div className="work-card-cover"><WorkCover key={work.coverAssetId ?? "text"} title={work.title} assetId={work.coverAssetId} caption={work.genres.map(g=>g.name).slice(0,2).join(" · ")}/><div className="work-platform-overlay">{work.platforms.slice(0,2).map(p=><PlatformBadge key={p.id} code={p.code}>{p.name}</PlatformBadge>)}</div><span className="work-status">{serialLabels[work.serialStatus]}</span></div>
    <div className="work-card-copy"><h2>{work.title}</h2>
      <p>{Array.from(new Set(work.creators.map(c=>c.name))).join(" · ") || "작가 정보 미등록"}</p>
      <p className="work-card-genres">{work.genres.map(g=>g.name).slice(0,2).join(" · ") || "장르 정보 미등록"}</p>
      {rating ? <p className="work-card-rating">{rating.average === null ? "평가 없음" : <><span aria-hidden="true">★ </span><span className="sr-only">공개 평균 별점 </span><strong>{rating.average.toFixed(2)}</strong><span className="sr-only">점</span> · 평가 {rating.ratingCount.toLocaleString("ko-KR")}건</>}</p> : null}
      {work.coverAttribution ? <p className="cover-attribution">{work.coverAttribution}</p> : null}
    </div>
  </Link></article>;
}
