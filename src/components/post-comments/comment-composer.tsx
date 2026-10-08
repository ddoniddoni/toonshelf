"use client";
import { useActionState,useId,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { createPostComment } from "@/lib/post-comments/actions";
export function CommentComposer({postId,postVersion,parentId=null}:{postId:string;postVersion:number;parentId?:string|null}) {
 const router=useRouter(),label=useId(),requestId=useRef<string|null>(null);const [body,setBody]=useState(""),[isSpoiler,setIsSpoiler]=useState(true),[confirm,setConfirm]=useState(false);
 const [feedback,action,pending]=useActionState(async(_previous:{ok:boolean;message:string}|null,form:FormData)=>{
  requestId.current ??= crypto.randomUUID();
  try {
   const reply=await createPostComment({id:requestId.current,postId,postVersion,parentId,body:form.get("body"),isSpoiler:form.get("isSpoiler") === "on",confirm:form.get("confirm") === "on"});
   if (!reply.ok) return {ok:false,message:reply.error.message};
   requestId.current=null;setBody("");setIsSpoiler(true);setConfirm(false);router.refresh();return {ok:true,message:parentId ? "답글을 등록했어요." : "댓글을 등록했어요."};
  } catch {return {ok:false,message:"등록 결과를 확인하지 못했어요. 내용을 바꾸지 않고 다시 시도하거나 최신 댓글을 확인해 주세요."};}
 },null);
 return <form action={action} className="account-form comment-form" aria-busy={pending}><fieldset disabled={pending}>
  <label className="form-field" htmlFor={label}>{parentId ? "답글" : "댓글"} (1~1000자)<textarea id={label} name="body" value={body} onChange={e=>setBody(e.target.value)} maxLength={2000} rows={3} required/></label>
  <label className="form-checkbox"><input type="checkbox" name="isSpoiler" checked={isSpoiler} onChange={e=>setIsSpoiler(e.target.checked)}/><span>스포일러가 포함돼요. 펼친 뒤 내용을 보여 주세요.</span></label>
  <label className="form-checkbox"><input type="checkbox" name="confirm" required checked={confirm} onChange={e=>setConfirm(e.target.checked)}/><span>이 댓글이 공개된다는 것을 확인했어요.</span></label>
  <p className="field-hint">답글은 한 단계까지만 쓸 수 있어요. 글이나 원 댓글에 스포일러가 있으면 답글도 가려져요.</p>
  <button className="button button-primary">{pending ? "등록 중…" : parentId ? "답글 등록" : "댓글 등록"}</button>
 </fieldset><p role={feedback && !feedback.ok ? "alert" : "status"} aria-live="polite">{feedback?.message}</p></form>;
}
