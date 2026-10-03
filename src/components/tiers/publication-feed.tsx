import Link from "next/link";
import { listPublicTiers } from "@/lib/tiers/publication-data";
export async function PublicationFeed({page}:{page:number}) {
 const tiers=await listPublicTiers(page);
 return <section className="page-container tier-publication-feed" aria-labelledby="published-tiers-title"><div className="section-heading"><h2 id="published-tiers-title">공개된 티어표</h2><Link href="/me/tiers" className="text-link">내 티어표 관리 →</Link></div>
  {!tiers ? <p>서비스 연결 후 공개된 티어표를 볼 수 있어요.</p> : <><div className="tier-draft-grid">{tiers.items.map(tier=><article className="review-card" key={tier.id}><span className="section-chip">{tier.isSpoiler ? "스포일러 포함" : "전체 공개"}</span><h3><Link href={`/tiers/${tier.id}`} prefetch={false}>{tier.title ?? "스포일러가 포함된 티어표"}</Link></h3><p>{tier.name} · <time dateTime={tier.publishedAt}>{new Date(tier.publishedAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</time></p><Link href={`/tiers/${tier.id}`} prefetch={false} className="text-link">현재 게시본 보기 →</Link></article>)}</div>{!tiers.items.length ? <p>이 페이지에 공개된 티어표가 없어요.</p> : null}<nav className="library-pagination" aria-label="공개 티어표 페이지">{page > 1 ? <Link href={`/tiers?page=${page-1}`}>이전</Link> : null}{tiers.hasNext && page < 1000 ? <Link href={`/tiers?page=${page+1}`}>다음</Link> : null}</nav></>}
 </section>;
}
