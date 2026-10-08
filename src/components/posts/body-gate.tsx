"use client";
import { useActionState } from "react";
import { revealPost,revealPostModeration } from "@/lib/posts/actions";
import { PostContent } from "./post-content";
export function PostBodyGate({id,version,moderation=false}:{id:string;version:number;moderation?:boolean}) {
 const [state,action,pending]=useActionState(moderation ? revealPostModeration : revealPost,null);
 if(state?.ok)return <PostContent title={state.title} body={state.body} works={state.works}/>;
 return <form action={action} className="review-body-gate" aria-busy={pending}><input type="hidden" name="id" value={id}/><input type="hidden" name="version" value={version}/><input type="hidden" name="confirm" value="on"/>
 <p>{moderation ? "현재 게시된 내용만 확인해요. 비공개 수정 초안은 제공되지 않아요." : "스포일러가 포함된 글이에요. 제목·본문·연결 작품을 함께 펼쳐요."}</p>
 <button type="submit" className="button button-secondary" disabled={pending}>{pending ? "확인 중…" : moderation ? "현재 게시 내용 확인" : "스포일러를 확인하고 글 펼치기"}</button>{state && !state.ok ? <p role="alert">{state.message}</p> : null}</form>;
}
