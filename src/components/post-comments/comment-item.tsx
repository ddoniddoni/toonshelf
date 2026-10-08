"use client";
import Link from "next/link";
import { useActionState,useId,useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePostComment,getMyPostComment,updatePostComment,revealPostComment,reportPostComment } from "@/lib/post-comments/actions";
import { commentPageUrl,type PostComment,type CommentEditor } from "@/lib/post-comments/model";
import { ReviewText } from "@/components/reviews/plain-text";
import { BlockForm } from "@/components/reviews/forms";
import { reportLabels } from "@/lib/reviews/model";
function CommentBody({comment,postVersion}:{comment:PostComment;postVersion:number}) {
 const [state,action,pending]=useActionState(async()=>{
  try {return await revealPostComment({id:comment.id,version:comment.version,postVersion,confirm:true});}
  catch {return {ok:false as const,error:{message:"현재 댓글을 확인하지 못했어요. 최신 페이지를 불러와 주세요."}};}
 },null);
 if (!comment.isSpoiler && comment.body !== null) return <ReviewText body={comment.body}/>;
 if (state?.ok) return <ReviewText body={state.body}/>;
 return <form action={action} className="review-body-gate"><p>글이나 댓글에 스포일러가 포함돼요.</p><button className="button button-secondary" disabled={pending}>{pending ? "확인 중…" : "스포일러 댓글 펼치기"}</button>{state && !state.ok ? <p role="alert">{state.error.message}</p> : null}</form>;
}
function CommentEdit({editor,postVersion}:{editor:CommentEditor;postVersion:number}) {
 const router=useRouter(),label=useId();const [body,setBody]=useState(editor.body),[isSpoiler,setIsSpoiler]=useState(editor.isSpoiler);
 const [state,action,pending]=useActionState(async(_previous:{ok:boolean;message:string}|null,form:FormData)=>{
  try {
   const reply=await updatePostComment({id:editor.id,version:editor.version,postVersion,body:form.get("body"),isSpoiler:form.get("isSpoiler") === "on",confirm:form.get("confirm") === "on"});
   if (!reply.ok) return {ok:false,message:reply.error.message};router.refresh();return {ok:true,message:"댓글을 수정했어요."};
  } catch {return {ok:false,message:"수정 결과를 확인하지 못했어요. 입력은 남아 있으니 최신 상태를 확인해 주세요."};}
 },null);
 return <form action={action} className="account-form comment-form"><fieldset disabled={pending || state?.ok === true}>
  <label className="form-field" htmlFor={label}>내 댓글 수정 (1~1000자)<textarea id={label} name="body" value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} rows={3} required/></label>
  <label className="form-checkbox"><input type="checkbox" name="isSpoiler" checked={isSpoiler} onChange={e=>setIsSpoiler(e.target.checked)}/><span>내 댓글에 스포일러가 포함돼요.</span></label>
  <label className="form-checkbox"><input type="checkbox" name="confirm" required/><span>수정한 내용을 공개할게요.</span></label>
  <button className="button button-primary">{pending ? "수정 중…" : "댓글 수정 저장"}</button>
 </fieldset><p role={state && !state.ok ? "alert" : "status"} aria-live="polite">{state?.message}</p></form>;
}
function CommentDelete({comment}:{comment:PostComment}) {
 const router=useRouter();const [state,action,pending]=useActionState(async(_previous:{ok:boolean;message:string}|null,form:FormData)=>{
  try {const reply=await deletePostComment({id:comment.id,version:comment.version,confirm:form.get("confirm") === "on"});
   if (!reply.ok) return {ok:false,message:reply.error.message};router.refresh();return {ok:true,message:"댓글 본문을 삭제했어요."};
  } catch {return {ok:false,message:"삭제 결과를 확인하지 못했어요. 최신 댓글을 불러와 주세요."};}
 },null);
 return <form action={action} className="account-form comment-form"><fieldset disabled={pending || state?.ok === true}><label className="form-checkbox"><input name="confirm" type="checkbox" required/><span>댓글 본문을 지울게요. 기존 답글은 유지돼요.</span></label><button className="button button-secondary">{pending ? "삭제 중…" : "댓글 삭제"}</button></fieldset><p role={state && !state.ok ? "alert" : "status"} aria-live="polite">{state?.message}</p></form>;
}
function CommentReport({comment,postVersion}:{comment:PostComment;postVersion:number}) {
 const label=useId();const [reason,setReason]=useState("spoiler"),[detail,setDetail]=useState("");
 const [state,action,pending]=useActionState(async(_previous:{ok:boolean;message:string}|null,form:FormData)=>{
  try {const reply=await reportPostComment({id:comment.id,version:comment.version,postVersion,reason:form.get("reason"),detail:form.get("detail")});
   return reply.ok ? {ok:true,message:"신고를 접수했어요. 같은 댓글의 처리 대기 신고는 중복 접수하지 않아요."} : {ok:false,message:reply.error.message};
  } catch {return {ok:false,message:"접수 결과를 확인하지 못했어요. 내 신고 목록을 확인해 주세요."};}
 },null);
 return <form action={action} className="account-form comment-form"><fieldset disabled={pending || state?.ok === true}>
  <label className="form-field">신고 사유<select name="reason" value={reason} onChange={e=>setReason(e.target.value)}>{Object.entries(reportLabels).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
  <label className="form-field" htmlFor={label}>확인이 필요한 내용 (10~2000자)<textarea id={label} name="detail" value={detail} onChange={e=>setDetail(e.target.value)} maxLength={4000} required rows={3}/></label><button className="button button-secondary">{pending ? "접수 중…" : "댓글 신고 접수"}</button>
 </fieldset><p role={state && !state.ok ? "alert" : "status"} aria-live="polite">{state?.message}</p><Link href="/me/post-comment-reports" className="text-link">내 댓글 신고와 결과 →</Link></form>;
}
export function CommentItem({comment,postVersion}:{comment:PostComment;postVersion:number}) {
 const [editor,setEditor]=useState<CommentEditor|null>(null),[message,setMessage]=useState(""),[pending,startTransition]=useTransition();
 function edit() {startTransition(async()=>{setMessage("");try {const reply=await getMyPostComment({id:comment.id,version:comment.version,postVersion});
  if (reply.ok) setEditor(reply.editor);else {setEditor(null);setMessage(reply.error.message);}
 } catch {setEditor(null);setMessage("수정할 댓글을 확인하지 못했어요.");}});}
 return <article className="review-card" id={`comment-${comment.id}`}>
  {comment.deleted ? <p>삭제된 댓글이에요. 기존 답글의 문맥을 위해 남겨 두었어요.</p> : <><p>{comment.author ? <Link href={`/u/${comment.author.username}`} prefetch={false}>{comment.author.name}</Link> : null} · <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time>{comment.updatedAt !== comment.createdAt ? " · 수정됨" : ""}</p><CommentBody key={`${comment.version}:${comment.isSpoiler}:${postVersion}`} comment={comment} postVersion={postVersion}/></>}
  {comment.parentId === null && (comment.replyCount > 0 || comment.canReply) ? <Link className="text-link" href={commentPageUrl(comment.postId,comment.id)} prefetch={false}>답글 {comment.replyCount}개 보기{comment.canReply ? " · 작성" : ""} →</Link> : null}
  {comment.canEdit ? <><button type="button" className="text-link" disabled={pending} onClick={edit}>{pending ? "확인 중…" : "내 댓글 수정"}</button>{editor ? <CommentEdit key={editor.version} editor={editor} postVersion={postVersion}/> : null}<p role="alert">{message}</p><details className="library-privacy-panel"><summary>내 댓글 삭제</summary><CommentDelete comment={comment}/></details></> : null}
  {comment.canReport && comment.author ? <><details className="library-privacy-panel"><summary>댓글 신고</summary><CommentReport comment={comment} postVersion={postVersion}/></details><details className="library-privacy-panel"><summary>댓글 작성자 차단</summary><BlockForm userId={comment.author.id} name={comment.author.name}/></details></> : null}
 </article>;
}
