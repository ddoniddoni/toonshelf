"use client";
import { useActionState } from "react";
import { revealTier } from "@/lib/tiers/publication-actions";
import { PublicationBoard } from "./publication-board";
export function TierPublicationGate({id,version,token}:{id:string;version:number;token:string|null}) {
 const [state,action,pending]=useActionState(async()=>{try {return await revealTier({id,version,token,confirm:true});} catch {return {ok:false as const,error:{code:"INTERNAL_ERROR" as const,message:"게시본을 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요."}};}},null);
 if (state?.ok) return <PublicationBoard body={state.publication.body!}/>;
 return <form action={action} className="review-body-gate" aria-busy={pending}><p>제목·설명·배치에 스포일러가 포함돼요. 내용을 펼치면 작품의 전개를 알게 될 수 있어요.</p><button className="button button-secondary" disabled={pending}>{pending ? "확인 중…" : "스포일러를 확인하고 티어표 펼치기"}</button>{state && !state.ok ? <p role="alert">{state.error.message}</p> : null}</form>;
}
