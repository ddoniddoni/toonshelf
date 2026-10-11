import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { AuthFailure } from "@/lib/auth/errors";
import { getTasteAnalysis } from "@/lib/discovery/analysis-data";
import { TasteAnalysisView } from "@/components/discovery/taste-analysis";
import { ConnectionNotice } from "@/components/auth/auth-shell";

export const dynamic="force-dynamic";
export const metadata={title:"내 취향 분석",robots:{index:false,follow:false}};
export default async function Page() {
 const account=await guardPage("/me/analysis");
 if(!account)return <section className="page-container review-detail"><h1>내 취향 분석</h1><ConnectionNotice/></section>;
 let result;
 try {result=await getTasteAnalysis();}catch(error) {
  if(error instanceof AuthFailure && ["CONFIG_REQUIRED","CONFLICT","INTERNAL_ERROR"].includes(error.code))
   return <section className="page-container review-detail"><h1>내 취향 분석</h1><p role="status">{error.message}</p><Link href="/me/analysis" prefetch={false}>다시 불러오기</Link></section>;
  throw error;
 }
 return <section className="page-container taste-analysis-page">
  <div className="hub-section-heading"><div><p className="eyebrow">MY TASTE</p><h1>내 취향 분석</h1><p>내 서재에 쌓인 취향을 살펴보세요.</p></div><Link className="button button-secondary" href="/me/library" prefetch={false}>내 서재</Link></div>
  <TasteAnalysisView result={result}/>
 </section>;
}
