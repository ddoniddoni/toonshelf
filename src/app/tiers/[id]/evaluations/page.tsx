import Link from "next/link";
import { notFound } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { parsePage } from "@/lib/library/model";
import { evaluationModeSchema,evaluationUrl } from "@/lib/tiers/evaluation-model";
import { getTierEvaluations } from "@/lib/tiers/evaluation-data";
import { EvaluationPanel } from "@/components/tiers/evaluation-panel";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"티어표와 내 기본 평가 연결",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<SearchParams>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const account=await guardPage(`/tiers/${id}/evaluations`);
 if (!account) return <section className="page-container tier-list-page"><h1>내 기본 평가 연결</h1><ConnectionNotice/></section>;
 const query=await searchParams;let mode:"import"|"apply",page:number;
 try {mode=evaluationModeSchema.parse(query.mode ?? "import");page=parsePage(query.page);}
 catch {return <section className="page-container tier-list-page"><h1>내 기본 평가 연결</h1><p role="alert">작업 종류와 페이지 번호를 확인해 주세요.</p><Link href={evaluationUrl(id,"import")}>첫 목록으로 이동</Link></section>;}
 const context=await getTierEvaluations(id,mode,page);if (!context) notFound();
 return <section className="page-container tier-list-page"><p className="eyebrow">CONNECT YOUR TASTE</p><h1>내 기본 평가 연결</h1><p>{context.title} · 저장된 초안 버전 {context.version}</p>
  <nav className="tier-list-actions" aria-label="기본 평가 연결 방향"><Link className="button button-secondary" aria-current={mode === "import" ? "page" : undefined} href={evaluationUrl(id,"import")}>내 기본 티어 가져오기</Link><Link className="button button-secondary" aria-current={mode === "apply" ? "page" : undefined} href={evaluationUrl(id,"apply")}>이 배치를 기본 평가로 반영</Link></nav>
  <EvaluationPanel key={`${id}:${mode}:${page}`} context={context}/>
  <nav className="library-pagination" aria-label="기본 평가 후보 페이지">{page > 1 ? <Link className="button button-secondary" href={evaluationUrl(id,mode,page-1)}>이전</Link> : null}<span>{page} 페이지 · 페이지를 옮기면 선택을 다시 해야 해요.</span>{context.hasMore ? <Link className="button button-secondary" href={evaluationUrl(id,mode,page+1)}>다음</Link> : null}</nav>
  <Link className="text-link" href={`/tiers/${id}/edit`}>← 초안 편집으로 돌아가기</Link>
 </section>;
}
