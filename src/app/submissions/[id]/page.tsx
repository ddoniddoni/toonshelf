import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { guardPage } from "@/lib/auth/session";
import { AuthFailure } from "@/lib/auth/errors";
import { catalogueError } from "@/lib/catalogue/errors";
import { uuidSchema } from "@/lib/catalogue/model";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"내 작품 제보 결과",robots:{index:false,follow:false}};
const submissionSchema=z.object({id:uuidSchema,proposal:z.string(),status:z.enum(["pending","accepted","rejected"]),result_note:z.string(),created_at:z.iso.datetime({offset:true}),reviewed_at:z.iso.datetime({offset:true}).nullable()});
const labels={pending:"검수 대기",accepted:"반영",rejected:"미반영"};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const account=await guardPage(`/submissions/${id}`);
 if (!account) return <section className="page-container submission-page"><h1>내 작품 제보 결과</h1><ConnectionNotice/></section>;
 const {data,error}=await account.client.from("toon_catalogue_submissions").select("id,proposal,status,result_note,reviewed_at,created_at").eq("id",id).eq("user_id",account.user.id).maybeSingle();
 catalogueError(error);if (!data) notFound();
 const parsed=submissionSchema.safeParse(data);
 if (!parsed.success || parsed.data.id!==id) throw new AuthFailure("INTERNAL_ERROR","제보 결과를 불러오지 못했어요.");
 const submission=parsed.data;
 return <section className="page-container submission-page"><Link className="text-link" href="/submissions" prefetch={false}>← 내 제보 목록</Link><h1>내 작품 제보 결과</h1>
  <div className="submission-list"><article><span className="work-status">{labels[submission.status]}</span><h2>내가 보낸 내용</h2><p className="submission-proposal">{submission.proposal}</p><p>접수 · <time dateTime={submission.created_at}>{new Date(submission.created_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time></p>
   {submission.status!=="pending" ? <div className="submission-result"><h2>검수 결과</h2><p className="submission-proposal">{submission.result_note || "처리가 완료됐어요."}</p>{submission.reviewed_at ? <time dateTime={submission.reviewed_at}>{new Date(submission.reviewed_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time> : null}</div> : null}
  </article></div>
 </section>;
}
