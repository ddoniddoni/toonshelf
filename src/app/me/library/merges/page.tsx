import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { ConnectionNotice } from "@/components/auth/auth-shell";
import { MergeHistoryDelete } from "@/components/library/merge-history-delete";
import { getMyMergeHistory } from "@/lib/library/merge-history";
import { parsePage,readingLabels } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
export const dynamic = "force-dynamic";
export const metadata = {title:"내 작품 병합 이력",robots:{index:false,follow:false}};
type ArchivedRecord = NonNullable<Awaited<ReturnType<typeof getMyMergeHistory>>["items"][number]["sourceRecord"]>;
function OriginalRecord({record,label}:{record:ArchivedRecord|null;label:string}) {
 if (!record) return <p>{label}: 서재 기록 없음</p>;
 return <details className="library-privacy-panel"><summary>{label}의 원본 기록</summary><dl>
  <dt>읽기 상태</dt><dd>{readingLabels[record.status]}</dd>
  <dt>서재 / 평가 공개 범위</dt><dd>{record.libraryVisibility === "private" ? "비공개" : "공개"} / {record.evaluationVisibility === "private" ? "비공개" : "공개"}</dd>
  <dt>별점 / 기본 티어</dt><dd>{record.ratingSteps === null ? "미평가" : record.ratingSteps / 2} / {record.canonicalTier ?? "미지정"}</dd>
  <dt>마지막 회차</dt><dd>{record.episode ?? "미지정"}</dd><dt>읽은 날짜</dt><dd>{record.startedOn ?? "미지정"} ~ {record.finishedOn ?? "미지정"}</dd>
  <dt>비공개 메모</dt><dd className="private-note">{record.note || "메모 없음"}</dd><dt>개인 태그</dt><dd>{record.tags.join(" · ") || "태그 없음"}</dd>
  <dt>기록 추가 / 수정 시각 (한국 시간)</dt><dd>{time(record.createdAt)} / {time(record.updatedAt)}</dd>
  <dt>평가 수정 시각 (한국 시간)</dt><dd>{record.evaluationUpdatedAt ? time(record.evaluationUpdatedAt) : "평가 없음"}</dd>
  <dt>진행 기록 수정 시각 (한국 시간)</dt><dd>{record.detailsUpdatedAt ? time(record.detailsUpdatedAt) : "진행 기록 없음"}</dd>
 </dl></details>;
}
const time = (value:string)=>new Date(value).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"});
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account = await guardPage("/me/library/merges");
 if (!account) return <section className="page-container reading-editor"><h1>내 작품 병합 이력</h1><ConnectionNotice/></section>;
 const params = await searchParams;let page:number;
 try {page = parsePage(params.page);} catch {return <section className="page-container reading-editor"><h1>내 작품 병합 이력</h1><p role="alert">페이지 번호를 확인해 주세요.</p><Link href="/me/library/merges">첫 페이지</Link></section>;}
 const history = await getMyMergeHistory(page);
 return <section className="page-container reading-editor"><Link className="text-link" href="/me/library">← 내 서재</Link><h1>내 작품 병합 이력</h1>
  <p>같은 작품이 하나로 합쳐질 때의 원본 기록이에요. 나만 확인할 수 있으며 현재 기록을 편집해도 이 보관본은 바뀌지 않아요. 필요한 내용은 복사해 보관하고, 보관본이 더 필요 없으면 이력을 삭제할 수 있어요.</p>
  {params.deleted === "1" ? <p role="status" className="form-success">보관한 원본 기록을 삭제했어요.</p> : null}
  <p>{history.total}건 · {page}페이지</p>
  {history.items.length ? history.items.map(item=><article key={item.id} className="admin-form-section">
   <h2>{item.sourceTitle ?? "합쳐진 작품"} → {item.targetTitle ?? "남긴 작품"}</h2><p>병합: {time(item.createdAt)} (한국 시간)</p>
   <p>최신 기록을 선택하고 메모·태그를 합쳤어요. 서재와 평가 공개 범위는 각각 더 제한적인 쪽을 유지했어요.</p>
   {item.currentTargetId ? <Link className="text-link" href={"/me/library/"+item.currentTargetId}>현재 내 기록 보기 →</Link> : <p>현재 서재 기록이 없어요.</p>}
   {item.reviewId ? <Link className="text-link" href={"/me/reviews/"+item.reviewId+"/edit"}>옮겨진 내 리뷰 확인 →</Link> : null}
   <OriginalRecord record={item.sourceRecord} label="합쳐진 작품"/><OriginalRecord record={item.targetRecord} label="남긴 작품"/>
   <details className="library-privacy-panel"><summary>보관한 원본 기록 삭제</summary><MergeHistoryDelete id={item.id}/></details>
  </article>) : <p>이 페이지에 병합 이력이 없어요.</p>}
  <nav aria-label="병합 이력 페이지">{page > 1 ? <Link className="button button-secondary" href={"/me/library/merges?page="+(page-1)}>이전</Link> : null}{history.hasNext ? <Link className="button button-secondary" href={"/me/library/merges?page="+(page+1)}>다음</Link> : null}</nav>
 </section>;
}
