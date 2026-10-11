import Link from "next/link";
import { ZodError } from "zod";
import { AuthFailure } from "@/lib/auth/errors";
import { catalogueOptions } from "@/lib/catalogue/data";
import type { SearchParams } from "@/lib/catalogue/model";
import { getWorkRankings } from "@/lib/discovery/rankings-data";
import { parseRankingFilters } from "@/lib/discovery/rankings-model";
import { RankingExplanation,RankingFiltersForm,WorkRankings } from "@/components/discovery/work-rankings";

export const metadata={title:"작품 순위",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
async function load(params:SearchParams) {
 try {
  const filters=parseRankingFilters(params);
  const [result,options]=await Promise.all([getWorkRankings(filters),catalogueOptions()]);
  return {ok:true as const,filters,result,options};
 }catch(error) {
  const message=error instanceof ZodError?"순위 조건과 페이지 주소를 다시 확인해 주세요.":error instanceof AuthFailure?error.message:"작품 순위를 불러오지 못했어요. 잠시 후 다시 방문해 주세요.";
  return {ok:false as const,message};
 }
}
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const data=await load(await searchParams);
 return <section className="page-container rankings-page">
  <div className="hub-section-heading"><div><p className="eyebrow">READER RATINGS</p><h1>독자의 기록으로 보는 작품 순위</h1><p>공개 평가의 수와 기준을 함께 살펴보세요.</p></div><Link className="text-link" href="/explore">작품 탐색 →</Link></div>
  <RankingExplanation/>
  {data.ok?<><RankingFiltersForm key={JSON.stringify(data.filters)} filters={data.filters} options={data.options}/><WorkRankings result={data.result}/></>:<div className="ranking-empty"><p role="status">{data.message}</p><Link href="/rankings" prefetch={false}>순위 다시 불러오기</Link></div>}
 </section>;
}
