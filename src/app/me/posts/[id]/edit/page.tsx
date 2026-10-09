import Link from "next/link";
import { notFound } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { uuidSchema,type SearchParams } from "@/lib/catalogue/model";
import { getMyPostEditor } from "@/lib/posts/data";
import { PostEditorForms } from "@/components/posts/editor";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"내 글 편집",robots:{index:false,follow:false}};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<SearchParams>}) {
 const {id}=await params;if(!uuidSchema.safeParse(id).success)notFound();const account=await guardPage(`/me/posts/${id}/edit`);
 if(!account)return <section className="page-container review-detail"><h1>내 글 편집</h1><ConnectionNotice/></section>;
 const [editor,query]=await Promise.all([getMyPostEditor(id),searchParams]);if(!editor)notFound();
 return <section className="page-container review-detail"><Link className="text-link" href="/me/posts" prefetch={false}>← 내 글과 초안</Link><h1>내 이야기 다듬기</h1><Link className="text-link" href={`/me/posts/${id}/merge-history`} prefetch={false}>작품 연결 변경 이력 →</Link>{query.saved==="1" ? <p className="form-success" role="status">초안을 저장했어요. 아래에서 저장된 내용을 공개할 수 있어요.</p> : null}{query.unpublished==="1" ? <p role="status">공개를 취소했어요.</p> : null}<PostEditorForms key={`${editor.draftVersion}:${editor.postVersion}`} editor={editor}/></section>;
}
