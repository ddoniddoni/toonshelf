import Link from "next/link";
import { notFound } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { getMyReviewEditor } from "@/lib/reviews/data";
import { EditorForms } from "@/components/reviews/forms";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic = "force-dynamic";
export const metadata = {title:"내 리뷰 편집",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<SearchParams>}) {
 const {id} = await params;if(!uuidSchema.safeParse(id).success) notFound();
 const account = await guardPage("/me/reviews/"+id+"/edit");if(!account) return <section className="page-container review-detail"><h1>내 리뷰 편집</h1><ConnectionNotice/></section>;
 const editor = await getMyReviewEditor(id);if(!editor) notFound();const query = await searchParams;
 return <section className="page-container review-detail"><Link className="text-link" href="/me/reviews">← 내 리뷰</Link><h1>{editor.work?.title ?? "현재 제공할 수 없는 작품"} 리뷰 편집</h1>{query.saved === "1" ? <p className="form-success" role="status">비공개 초안을 저장했어요. 현재 게시본은 그대로예요.</p> : null}{query.unpublished === "1" ? <p role="status">리뷰 공개를 취소했어요.</p> : null}<EditorForms key={editor.draftVersion+":"+editor.reviewVersion} editor={editor}/></section>;
}
