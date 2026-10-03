"use client";
import Link from "next/link";
import { startTransition,useEffect,useState } from "react";
import { Search } from "lucide-react";
import { WorkCover } from "@/components/catalogue/work-cover";
import type { WorkCard } from "@/lib/catalogue/model";
import { searchTierWorks } from "@/lib/tiers/actions";
export function TierWorkPicker({selected,onAdd,disabled=false}:{selected:string[];onAdd:(work:WorkCard)=>void;disabled?:boolean}) {
 const [origin,setOrigin]=useState<"library"|"catalogue">("library"),[q,setQ]=useState(""),[page,setPage]=useState(1);
 const [result,setResult]=useState<{items:WorkCard[];hasNext:boolean}>({items:[],hasNext:false});
 const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  const timer=setTimeout(()=>{setLoading(true);setError(null);startTransition(async()=>{
   try {const reply=await searchTierWorks({origin,q:q.trim(),page});if (!active) return;if (reply.ok) setResult(reply.data);else {setResult({items:[],hasNext:false});setError(reply.error.message);}}
   catch {if (active) {setResult({items:[],hasNext:false});setError("작품을 불러오지 못했어요. 다시 시도해 주세요.");}}
   finally {if (active) setLoading(false);}
  });},300);
  return ()=>{active=false;clearTimeout(timer);};
 },[origin,q,page,retry]);
 function switchOrigin(value:"library"|"catalogue") {setOrigin(value);setPage(1);setResult({items:[],hasNext:false});setLoading(true);}
 return <aside className="tier-preview-pool"><div className="tier-pool-tabs" role="group" aria-label="작품 찾을 곳"><button type="button" aria-pressed={origin === "library"} onClick={()=>switchOrigin("library")}>내 서재에서 추가</button><button type="button" aria-pressed={origin === "catalogue"} onClick={()=>switchOrigin("catalogue")}>전체 웹툰 검색</button></div>
  <div className="tier-pool-filters"><label><Search size={16} aria-hidden="true"/><input aria-label="추가할 작품 검색" maxLength={200} placeholder="작품 제목·작가 검색" value={q} onChange={e=>{setQ(e.target.value);setPage(1);setLoading(true);setResult({items:[],hasNext:false});}}/></label></div>
  <div className="tier-picker-results" aria-busy={loading}>{loading ? <p role="status">작품을 찾고 있어요…</p> : error ? <><p role="alert">{error}</p><button className="button button-secondary" onClick={()=>setRetry(n=>n+1)}>다시 불러오기</button></> : result.items.length ? result.items.map(work=><div className="tier-picker-work" key={work.id}><WorkCover title={work.title} assetId={work.coverAssetId}/><div><strong>{work.title}</strong><small>{work.creators.map(c=>c.name).join(" · ")}</small><button type="button" className="button button-secondary" disabled={disabled || selected.includes(work.id) || selected.length >= 300} onClick={()=>onAdd(work)}>{selected.includes(work.id) ? "추가됨" : "미배치에 추가"}</button></div></div>) : <p>{origin === "library" ? "서재에 추가할 작품이 없어요. 전체 웹툰 검색에서도 찾을 수 있어요." : "검색 결과가 없어요. 다른 제목으로 찾아보세요."}</p>}</div>
  <nav className="tier-picker-pages" aria-label="작품 검색 페이지"><button disabled={loading || page === 1} onClick={()=>{setPage(n=>n-1);setLoading(true);}}>이전</button><span>{page}페이지</span><button disabled={loading || !result.hasNext} onClick={()=>{setPage(n=>n+1);setLoading(true);}}>다음</button></nav><Link className="tier-pool-footer" href="/submissions/new">미등록 작품 제보 →</Link>
 </aside>;
}
