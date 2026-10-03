import Link from "next/link";
import { notFound } from "next/navigation";
import { guardModeratorPage } from "@/lib/reviews/moderation";
import { getTierModeration } from "@/lib/tiers/publication-data";
import { uuidSchema } from "@/lib/catalogue/model";
import { reportLabels } from "@/lib/reviews/model";
import { PublicationBoard } from "@/components/tiers/publication-board";
import { ModerateTierForm } from "@/components/tiers/publication-forms";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"티어표 운영 검토",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const account=await guardModeratorPage(`/admin/tiers/${id}`);if (!account) return <section className="page-container review-detail"><h1>티어표 운영 검토</h1><ConnectionNotice/></section>;
 const snapshot=await getTierModeration(id);if (!snapshot) notFound();
 return <section className="page-container review-detail"><Link href="/admin/tier-reports" className="text-link">← 티어표 신고 목록</Link><h1>티어표 운영 검토</h1><p>{snapshot.deleted ? "작성자가 삭제한 티어표" : snapshot.visibility === "private" ? "비공개 / 게시 취소" : "현재 게시본"} · {snapshot.moderationStatus === "hidden" ? "운영자 숨김" : "숨김 없음"}</p>
  {snapshot.body ? <><p>현재 게시된 제목·설명·배치만 제공해요. 스포일러가 포함될 수 있어요.</p><PublicationBoard body={snapshot.body}/></> : <p>현재 검토할 게시본이 없어요. 비공개 초안과 게시 취소한 본문은 운영자에게 제공하지 않아요.</p>}
  <h2>최근 신고 (최대 50건)</h2><div className="review-list">{snapshot.reports.map(r=><article key={r.id} className="review-card"><h3>{reportLabels[r.reason]}</h3><p>{r.status}</p><p className="private-note">{r.detail}</p><p>{r.result}</p></article>)}</div><ModerateTierForm key={snapshot.version} snapshot={snapshot}/>
  <h2>최근 운영 이력 (최대 50건)</h2><div className="review-list">{snapshot.events.map((e,i)=><article key={i} className="review-card"><h3>{e.action}</h3><p className="private-note">{e.reason}</p><p>{e.createdAt}</p></article>)}</div>
 </section>;
}
