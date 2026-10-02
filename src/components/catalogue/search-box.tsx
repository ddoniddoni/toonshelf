"use client";

import Link from "next/link";
import { z } from "zod";
import { useEffect,useId,useState } from "react";
import { Search } from "lucide-react";
import { cardSchema,type CatalogueFilters } from "@/lib/catalogue/model";
const responseSchema = z.object({items:z.array(cardSchema)});
export function SearchBox({initial,filters,disabled=false}:{initial:string;filters:CatalogueFilters;disabled?:boolean}) {
  const id = useId();const [value,setValue] = useState(initial);
  const [suggestions,setSuggestions] = useState<{id:string;slug:string;title:string}[]>([]);
  const [open,setOpen] = useState(false);
  useEffect(()=>{
    if (disabled || !value.trim() || Array.from(value.trim()).length > 100) return;
    const controller = new AbortController();
    const timer = setTimeout(async()=>{
      const query = new URLSearchParams({q:value.trim(),sort:"latest"});
      for (const p of filters.platform) query.append("platform",p);
      for (const g of filters.genre) query.append("genre",g);
      for (const d of filters.day) query.append("day",String(d));
      if(filters.status)query.set("status",filters.status);if(filters.age)query.set("age",filters.age);
      try {
        const response = await fetch("/api/works/search?"+query,{signal:controller.signal,cache:"no-store"});
        const body:unknown = await response.json();
        if (response.ok && body && typeof body === "object" && "data" in body) {
          const parsed = responseSchema.safeParse(body.data);
          if (parsed.success) setSuggestions(parsed.data.items);
        }
      } catch { /* Full search remains available when suggestions cannot load. */ }
    },350);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[value,disabled,filters.platform,filters.genre,filters.day,filters.status,filters.age]);
  return <div className="catalogue-search-box"><label className="sr-only" htmlFor={id}>작품 제목·별칭·작가 검색</label>
    <Search size={19} className="search-field-icon" aria-hidden="true"/>
    <input id={id} name="q" value={value} disabled={disabled} maxLength={200} placeholder="제목, 별칭, 작가로 찾아보세요" autoComplete="off"
      onChange={event=>{setValue(event.target.value);setSuggestions([]);setOpen(true);}} onFocus={()=>setOpen(true)} onKeyDown={event=>{if(event.key === "Escape")setOpen(false);}}/>
    {open && suggestions.length ? <div className="search-suggestions"><p>작품 바로가기</p><ul>{suggestions.map(w=><li key={w.id}><Link href={"/works/"+w.slug}>{w.title}</Link></li>)}</ul><button type="button" className="text-link" onClick={()=>setOpen(false)}>닫기</button></div> : null}
  </div>;
}
