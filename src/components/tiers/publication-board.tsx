import Link from "next/link";
import type { PublicationBody } from "@/lib/tiers/publication-model";
export function PublicationBoard({body}:{body:PublicationBody}) {
 return <section className="tier-publication-board"><h2>{body.title}</h2>{body.description ? <p className="private-note">{body.description}</p> : null}
  {body.tags.length ? <ul className="tier-publication-tags" aria-label="티어표 태그">{body.tags.map(tag=><li key={tag}>{tag}</li>)}</ul> : null}
  <div className="tier-board-rows">{body.rows.map(row=><div className="tier-preview-row" data-tier={row.colorToken} key={row.id}><div className="tier-row-label"><strong>{row.label}</strong><span>{row.canonicalTier ? "기본 티어 "+row.canonicalTier : "사용자 행"}</span></div><div className="tier-row-works">{row.items.length ? row.items.map((work,i)=><article className="tier-work-card" key={work?.id ?? `unavailable-${i}`}>
   {work ? <><Link href={`/works/${work.slug}`} prefetch={false} className="tier-text-cover">{work.title}</Link><p>{work.creators.map(c=>c.name).join(" · ") || "작가 정보 확인 중"}</p></> : <><div className="tier-text-cover">제공할 수 없는 작품</div><p>작품 정보가 공개되지 않아요.</p></>}
  </article>) : <span className="tier-row-empty">비어 있음</span>}</div></div>)}</div>
 </section>;
}
