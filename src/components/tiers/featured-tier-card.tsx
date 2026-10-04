import Link from "next/link";
import type { z } from "zod";
import type { publicTierCardSchema } from "@/lib/tiers/publication-model";
import { tierDiscoveryUrl } from "@/lib/tiers/discovery-model";

export function FeaturedTierCard({tier}:{tier:z.infer<typeof publicTierCardSchema>}) {
 return <article className="review-card">
  <span className="section-chip">{tier.isSpoiler ? "스포일러 포함" : "전체 공개"}</span>
  <h3><Link href={`/tiers/${tier.id}`} prefetch={false}>{tier.isSpoiler ? "스포일러가 포함된 티어표" : tier.title}</Link></h3>
  <p>게시 <time dateTime={tier.publishedAt}>{new Date(tier.publishedAt).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}</time> · 좋아요 {tier.likeCount.toLocaleString("ko-KR")}개</p>
  {!tier.isSpoiler && tier.tags?.length ? <div className="tier-publication-tags" aria-label="대표 티어표 테마">{tier.tags.map(tag=><Link key={tag} className="section-chip" href={tierDiscoveryUrl({sort:"latest",tag})} prefetch={false}>#{tag}</Link>)}</div> : null}
  <Link href={`/tiers/${tier.id}`} prefetch={false} className="text-link">현재 게시본 보기 →</Link>
 </article>;
}
