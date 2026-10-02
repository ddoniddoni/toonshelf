import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicEnv } from "@/lib/env/public";
import { usernameSchema } from "@/lib/auth/validation";
import { AuthFailure } from "@/lib/auth/errors";
import { catalogueOptions } from "@/lib/catalogue/data";
import type { SearchParams } from "@/lib/catalogue/model";
import { getPublicLibrary } from "@/lib/library/data";
import { parsePage,parsePublicLibraryFilters,publicLibraryUrl,type PublicLibrary,type PublicLibraryFilters } from "@/lib/library/model";
import { PublicLibraryItems } from "@/components/library/public-library-items";
import { PublicLibraryFilterForm } from "@/components/library/public-filter-form";

export const dynamic = "force-dynamic";
export const metadata = {title:"회원 공개 서재",robots:{index:false,follow:false}};
function InvalidQuery({username}:{username:string}) {
 return <section className="page-container public-library-page"><h1>공개 서재</h1><p role="alert">검색 조건이나 페이지 번호를 확인해 주세요.</p><Link className="text-link" href={"/u/"+username+"/library"}>조건 초기화</Link></section>;
}
export default async function Page({params,searchParams}:{params:Promise<{username:string}>;searchParams:Promise<SearchParams>}) {
 const {username} = await params;
 if (!getPublicEnv().supabase || !usernameSchema.safeParse(username).success) notFound();
 const query = await searchParams;let page:number,filters:PublicLibraryFilters;
 try {filters = parsePublicLibraryFilters(query);page = parsePage(query.page);}
 catch {return <InvalidQuery username={username}/>;}
 let result:[PublicLibrary|null,Awaited<ReturnType<typeof catalogueOptions>>];
 try {result = await Promise.all([getPublicLibrary(username,page,filters),catalogueOptions()]);}
 catch (error) {if (error instanceof AuthFailure && error.code === "VALIDATION_ERROR") return <InvalidQuery username={username}/>;throw error;}
 const [library,options] = result;if (!library) notFound();
 return <section className="page-container public-library-page"><Link className="text-link" href={"/u/"+username}>← 공개 프로필</Link>
  <div className="hub-section-heading"><div><h1>@{username}의 공개 서재</h1><p>공개한 서재 상태와 평가만 찾아볼 수 있어요.</p></div></div>
  <PublicLibraryFilterForm username={username} filters={filters} options={options}/>
  <p className="library-result-count" role="status">검색 결과 {library.total}편 · {page}페이지</p>
  {library.items.length ? <PublicLibraryItems items={library.items}/> : <div className="library-empty"><h2>{library.total ? "이 페이지에 공개 기록이 없어요" : "조건에 맞는 공개 기록이 없어요"}</h2><p>비공개 항목은 결과에 포함하지 않아요. 검색 조건을 바꿔 보세요.</p><Link className="text-link" href={library.total ? publicLibraryUrl(username,filters) : "/u/"+username+"/library"}>{library.total ? "첫 페이지로 이동" : "조건 초기화"}</Link></div>}
  <nav className="library-pagination" aria-label="공개 서재 페이지">{page > 1 ? <Link className="button button-secondary" href={publicLibraryUrl(username,filters,page-1)}>이전</Link> : null}{library.hasNext ? <Link className="button button-secondary" href={publicLibraryUrl(username,filters,page+1)}>다음</Link> : null}</nav>
  <p className="field-hint">작품 저장은 로그인 후 가능해요. 다른 사람의 평가와 비공개 기록은 가져오지 않아요.</p>
 </section>;
}
