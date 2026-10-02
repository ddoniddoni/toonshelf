import { TierBadge } from "./catalogue-badges";

const tiers = ["S", "A", "B", "C", "D", "F"] as const;
export function TierDistribution({ counts, total }: { counts: Record<string,number>; total: number }) {
  return <div className="tier-distribution">{tiers.map(tier=>{
    const count = counts[tier] ?? 0;
    const percentage = total > 0 ? count / total * 100 : 0;
    return <div className="tier-distribution-row" key={tier}>
      <TierBadge tier={tier}/><div className="tier-distribution-track" aria-hidden="true"><span data-tier={tier} style={{width:percentage+"%"}}/></div><span>{count}건 <span className="sr-only">({percentage.toFixed(1)}%)</span></span>
    </div>;
  })}</div>;
}
