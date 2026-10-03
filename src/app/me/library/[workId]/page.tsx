import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { getMySettings } from "@/lib/auth/data";
import { getMyRecord } from "@/lib/library/data";
import { getMyMergedWorkTarget } from "@/lib/library/merge-history";
import { getWorkDetail } from "@/lib/catalogue/data";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { RecordForm } from "@/components/library/record-form";
import { BulkLibraryForm } from "@/components/library/bulk-form";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic = "force-dynamic";
export const metadata = {title:"내 독서 기록",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{workId:string}>;searchParams:Promise<SearchParams>}) {
 const {workId} = await params;if (!uuidSchema.safeParse(workId).success) notFound();
 const account = await guardPage("/me/library/"+workId);
 if (!account) return <section className="page-container reading-editor"><h1>내 독서 기록</h1><ConnectionNotice/></section>;
 const [record,settings,query] = await Promise.all([getMyRecord(workId),getMySettings(),searchParams]);
 if (!record) {const target = await getMyMergedWorkTarget(workId);if (target) redirect("/me/library/"+target+"?merged=1");notFound();}
 const work = record.work ? await getWorkDetail(record.work.slug) : null;
 return <section className="page-container reading-editor"><Link className="text-link" href="/me/library">← 내 서재</Link><p className="eyebrow">MY READING RECORD</p><h1>{work?.title ?? "현재 공개할 수 없는 작품"}</h1>
  {query.saved === "1" ? <p className="form-success" role="status">기록을 저장했어요.</p> : null}
  {query.merged === "1" ? <p role="status">같은 작품의 기록이 병합되어 현재 기록으로 이동했어요. <Link className="text-link" href="/me/library/merges">원본 기록 확인</Link></p> : null}
  <p className="field-hint">마지막 저장: {new Date(record.updatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} (한국 시간)</p>
  {work && settings ? <><Link className="text-link" href={"/works/"+work.slug}>작품 정보 보기 →</Link><RecordForm key={record.version} work={work} record={record} defaults={{library:settings.default_library_visibility,evaluation:settings.default_evaluation_visibility}}/></> : <><p>작품 정보가 숨겨졌거나 현재 제공할 수 없어요. 새 기록·평가·공개 전환은 제한되지만 내 기존 메모는 확인하고 기록을 삭제하거나 비공개로 바꿀 수 있어요.</p><dl><dt>비공개 메모</dt><dd className="private-note">{record.note || "메모 없음"}</dd><dt>읽은 날짜</dt><dd>{record.startedOn ?? "미지정"} ~ {record.finishedOn ?? "미지정"}</dd></dl></>}
  <details className="library-privacy-panel"><summary>이 기록 삭제·공개 범위 변경</summary><BulkLibraryForm items={[record]}/></details>
 </section>;
}
