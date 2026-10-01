import Link from "next/link";
import type { WorkCard as Card } from "@/lib/catalogue/model";
import { serialLabels } from "@/lib/catalogue/model";
import { WorkCover } from "./work-cover";
export function WorkCard({work}:{work:Card}) {
  return <article className="work-card"><Link href={"/works/"+work.slug} className="work-card-link">
    <WorkCover key={work.coverAssetId ?? "text"} title={work.title} assetId={work.coverAssetId} caption={work.genres.map(g=>g.name).slice(0,2).join(" · ")}/>
    <div className="work-card-copy"><span className="work-status">{serialLabels[work.serialStatus]}</span><h2>{work.title}</h2>
      <p>{Array.from(new Set(work.creators.map(c=>c.name))).join(" · ") || "작가 정보 미등록"}</p>
      <div className="platform-tags">{work.platforms.map(p=><span key={p.id}>{p.name}</span>)}</div>
      {work.coverAttribution ? <p className="cover-attribution">{work.coverAttribution}</p> : null}
    </div>
  </Link></article>;
}
