import { withReviewAvailability } from "@/lib/reviews/availability";
import { ReviewAvailabilityNotice } from "@/components/reviews/availability-notice";
import Link from "next/link";
import { notFound } from "next/navigation";
import { guardModeratorPage } from "@/lib/reviews/moderation";
import { getCommentModeration } from "@/lib/review-comments/data";
import { uuidSchema } from "@/lib/catalogue/model";
import { reportLabels } from "@/lib/reviews/model";
import { ModerateCommentForm,ModerationCommentBody } from "@/components/review-comments/moderation-forms";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"리뷰 댓글 운영 검토",robots:{index:false,follow:false}};
const actionLabels:Record<string,string>={hide:"댓글 숨김",restore:"숨김 해제",reject_report:"신고 기각"};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const account=await guardModeratorPage(`/admin/review-comments/${id}`);if (!account) return <section className="page-container review-detail"><h1>리뷰 댓글 운영 검토</h1><ConnectionNotice/></section>;
 const loaded=await withReviewAvailability(()=>getCommentModeration(id));
 if(!loaded.available)return <section className="page-container review-detail"><h1>리뷰 댓글 운영 검토</h1><ReviewAvailabilityNotice href="/admin/reports"/></section>;
 const snapshot=loaded.value;if (!snapshot) notFound();
 return <section className="page-container review-detail"><Link href="/admin/review-comment-reports" prefetch={false} className="text-link">← 댓글 신고 목록</Link><h1>리뷰 댓글 운영 검토</h1><p>{snapshot.deleted ? "본문이 삭제된 댓글" : "댓글"} · {snapshot.moderationStatus === "hidden" ? "운영자 숨김" : "숨김 없음"}</p>
  <ModerationCommentBody key={snapshot.version} snapshot={snapshot}/>
  <h2>최근 신고 (최대 50건)</h2><div className="review-list">{snapshot.reports.map(r=><article key={r.id} className="review-card"><h3>{reportLabels[r.reason]}</h3><p>{r.status === "pending" ? "처리 대기" : r.status === "resolved" ? "처리 완료" : "기각"}</p><p className="private-note">{r.detail}</p><p>{r.result}</p></article>)}</div><ModerateCommentForm key={snapshot.version} snapshot={snapshot}/>
  <h2>최근 운영 이력 (최대 50건)</h2><div className="review-list">{snapshot.events.map((e,i)=><article key={`${e.createdAt}:${i}`} className="review-card"><h3>{actionLabels[e.action] ?? "운영 조치"}</h3><p className="private-note">{e.reason}</p><p>{e.createdAt}</p></article>)}</div>
 </section>;
}
