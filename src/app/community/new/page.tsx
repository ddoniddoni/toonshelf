import { randomUUID } from "node:crypto";
import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { createPost } from "@/lib/posts/actions";
import { ActionForm } from "@/components/forms/action-form";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"새 커뮤니티 글",robots:{index:false,follow:false}};
export default async function Page() {
 const account=await guardPage("/community/new");
 return <section className="page-container review-detail"><Link className="text-link" href="/community">← 커뮤니티</Link><h1>어떤 이야기를 나눌까요?</h1><p>비공개 초안으로 시작해요. 내용을 저장하고 공개 게시를 눌러야 다른 독자에게 보여요.</p>{account ? <ActionForm action={createPost} submitLabel="새 글 작성 시작"><input type="hidden" name="id" value={randomUUID()}/></ActionForm> : <ConnectionNotice/>}</section>;
}
