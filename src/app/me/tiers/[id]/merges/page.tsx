import Link from "next/link";
import { notFound } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { parsePage } from "@/lib/library/model";
import { getTierEditor,getTierMergeHistory } from "@/lib/tiers/data";
import { TierMergeNoticeView } from "@/components/tiers/merge-notice";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const metadata={title:"티어표 병합 원본",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<SearchParams>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const account=await guardPage(`/me/tiers/${id}/merges`);if (!account) return <section className="page-container tier-list-page"><ConnectionNotice/></section>;
 const search=await searchParams;let page:number;try {page=parsePage(search.page);} catch {notFound();}
 const history=await getTierMergeHistory(id,page);if (!history) notFound();const editor=await getTierEditor(id);if (!editor) notFound();
 const titles=Object.fromEntries(editor.works.flatMap(w=>w.work ? [[w.workId,w.work.title]] : []));
 return <section className="page-container tier-list-page"><Link className="text-link" href={`/tiers/${id}/edit`}>← 초안 편집</Link><h1>티어표 병합 원본</h1><p>나만 볼 수 있는 병합 전 배치예요. 현재 초안과 기본 평가는 바꾸지 않아요. 초안을 삭제하면 이 보관본도 삭제돼요.</p><div className="tier-merge-notices">{history.items.map(n=><TierMergeNoticeView key={n.id} notice={n} titles={titles}/>)}{!history.items.length ? <p>이 페이지에 병합 이력이 없어요.</p> : null}</div><nav className="library-pagination" aria-label="티어 병합 이력 페이지">{page > 1 ? <Link href={`/me/tiers/${id}/merges?page=${page-1}`}>이전</Link> : null}{history.hasNext ? <Link href={`/me/tiers/${id}/merges?page=${page+1}`}>다음</Link> : null}</nav></section>;
}
