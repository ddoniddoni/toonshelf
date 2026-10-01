import { notFound } from "next/navigation";
import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { catalogueError } from "@/lib/catalogue/errors";
import { getWorkDetail } from "@/lib/catalogue/data";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { SuggestionForm } from "@/components/catalogue/suggestion-form";
import { EmptyState } from "@/components/ui/empty-state";
export const metadata = {title:"작품 정보 제보",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
  const params = await searchParams;
  const workId = typeof params.work === "string" ? uuidSchema.parse(params.work) : null;
  const account = await guardPage("/submissions/new"+(workId ? "?work="+workId : ""));
  let workTitle:string|undefined;
  if(account && workId) {
    const {data,error} = await account.client.from("works").select("slug").eq("id",workId).maybeSingle();catalogueError(error);
    const detail = data ? await getWorkDetail(data.slug) : null;if(!detail)notFound();workTitle = detail.title;
  }
  return <div className="page-container submission-page"><header className="catalogue-heading"><div><p className="eyebrow">함께 정확한 카탈로그 만들기</p><h1>작품 정보를 알려 주세요.</h1><p>새 작품, 잘못된 정보, 사라진 공식 링크를 제보할 수 있어요.</p></div><Link className="text-link" href="/submissions">내 제보와 처리 결과</Link></header>
    {account ? <SuggestionForm workId={workId} workTitle={workTitle}/> : <EmptyState title="작품 제보를 준비하고 있어요" description="계정 연결이 완료되면 출처와 함께 작품 정보를 제보할 수 있어요."/>}
  </div>;
}
