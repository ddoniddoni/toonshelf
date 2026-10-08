import Link from "next/link";
import { notFound } from "next/navigation";
import { guardModeratorPage } from "@/lib/reviews/moderation";
import { getPostModeration } from "@/lib/posts/data";
import { uuidSchema } from "@/lib/catalogue/model";
import { reportLabels } from "@/lib/reviews/model";
import { ModerationForm } from "@/components/posts/moderation-forms";
import { PostBodyGate } from "@/components/posts/body-gate";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic = "force-dynamic";
export const metadata = {title:"글 운영 검토",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id} = await params;if(!uuidSchema.safeParse(id).success)notFound();const account = await guardModeratorPage("/admin/posts/"+id);
 if(!account)return <section className="page-container review-detail"><h1>글 운영 검토</h1><ConnectionNotice/></section>;
 const snapshot = await getPostModeration(id);if(!snapshot)notFound();
 return <section className="page-container review-detail"><Link className="text-link" href="/admin/post-reports">← 신고 목록</Link><h1>글 운영 검토</h1><p>{snapshot.deleted ? "작성자가 삭제한 글" : snapshot.publicationStatus === "published" ? "게시된 글" : "공개 취소 / 비공개"} · {snapshot.moderationStatus === "hidden" ? "운영자 숨김" : "숨김 없음"}</p>
  {!snapshot.deleted && snapshot.publicationStatus === "published" ? <PostBodyGate key={snapshot.version} id={id} version={snapshot.version} moderation/> : <p>현재 게시된 본문은 없어요. 비공개 초안과 공개 취소한 본문은 운영자에게 제공하지 않아요.</p>}
  <h2>최근 신고 (최대 50건)</h2><div className="review-list">{snapshot.reports.map(r=><article className="review-card" key={r.id}><h3>{reportLabels[r.reason]}</h3><p>{r.status}</p><p className="private-note">{r.detail}</p><p>{r.result_note}</p></article>)}</div>
  <ModerationForm key={snapshot.version+":"+snapshot.reports.filter(r=>r.status === "pending").map(r=>r.id).join(",")} snapshot={snapshot}/>
  <h2>최근 운영 이력 (최대 50건)</h2><div className="review-list">{snapshot.events.map((e,index)=><article className="review-card" key={index}><h3>{e.action}</h3><p className="private-note">{e.reason}</p><p>{e.created_at}</p></article>)}</div>
 </section>;
}
