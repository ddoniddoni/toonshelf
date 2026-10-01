"use client";

import { useState } from "react";
import { TypographyCover } from "@/components/work/typography-cover";
export function WorkCover({title,assetId,caption}:{title:string;assetId:string|null;caption?:string}) {
  const [failed,setFailed] = useState(false);
  const tone = (["iris","mint","peach"] as const)[Array.from(title).reduce((sum,c)=>sum+c.codePointAt(0)!,0)%3];
  return <div className="work-cover"><div aria-hidden={Boolean(assetId && !failed)}><TypographyCover title={title} caption={caption} tone={tone}/></div>
    {assetId && !failed ? <picture><img src={"/api/covers/"+assetId} alt={title+" 표지"} width={300} height={450} loading="lazy" onError={()=>setFailed(true)}/></picture> : null}
  </div>;
}
