import Link from "next/link";
import { notFound } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { usernameSchema } from "@/lib/auth/validation";
import { AuthFailure } from "@/lib/auth/errors";
import type { SearchParams } from "@/lib/catalogue/model";
import { comparisonUrl,parseComparisonSearch } from "@/lib/discovery/comparison-model";
import { getTasteComparison } from "@/lib/discovery/comparison-data";
import { TasteComparisonResult } from "@/components/discovery/taste-comparison";
import { ConnectionNotice } from "@/components/auth/auth-shell";

export const dynamic="force-dynamic";
export const metadata={title:"취향 비교",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{username:string}>;searchParams:Promise<SearchParams>}) {
 const {username}=await params;if(!usernameSchema.safeParse(username).success)notFound();
 let query;try {query=parseComparisonSearch(await searchParams);}catch{return <section className="page-container review-detail"><h1>취향 비교</h1><p role="alert">비교 조건이나 페이지 번호를 확인해 주세요.</p><Link href={comparisonUrl(username)}>처음부터 비교하기</Link></section>;}
 const account=await guardPage(comparisonUrl(username,query.section,query.page));
 if(!account)return <section className="page-container review-detail"><h1>취향 비교</h1><ConnectionNotice/></section>;
 let comparison;
 try {comparison=await getTasteComparison({username,...query});}
 catch(error) {
  if(error instanceof AuthFailure && ["CONFIG_REQUIRED","VALIDATION_ERROR","CONFLICT"].includes(error.code))
   return <section className="page-container review-detail"><h1>취향 비교</h1><p role="status">{error.message}</p><Link href={"/u/"+username} prefetch={false}>프로필로 돌아가기</Link></section>;
  throw error;
 }
 if(!comparison)notFound();
 return <section className="page-container comparison-page"><Link className="text-link" href={"/u/"+username} prefetch={false}>← 프로필로 돌아가기</Link><TasteComparisonResult comparison={comparison}/></section>;
}
