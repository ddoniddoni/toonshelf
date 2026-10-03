"use client";
import { useState } from "react";
export function PublicationShare() {
 const [message,setMessage]=useState("");
 function address() {const url=new URL(window.location.href);url.search="";url.hash="";return url.href;}
 async function copy() {try {await navigator.clipboard.writeText(address());setMessage("주소를 복사했어요.");} catch {setMessage("브라우저 주소창에서 이 페이지 주소를 복사해 주세요.");}}
 async function share() {try {if (!navigator.share) {setMessage("이 브라우저에서는 주소 복사를 이용해 주세요.");return;}await navigator.share({title:"ToonShelf · 티어표",url:address()});} catch(error) {if (!(error instanceof Error && error.name === "AbortError")) setMessage("주소 복사로 공유해 주세요.");}}
 return <div className="tier-publication-share"><div className="tier-list-actions"><button className="button button-secondary" onClick={copy}>게시본 주소 복사</button><button className="button button-secondary" onClick={share}>기기 공유 메뉴</button></div><p role="status" aria-live="polite">{message}</p></div>;
}
