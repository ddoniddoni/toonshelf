import "server-only";
import { join } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { imageText,escapeImageText,paginateTierImage,type TierImageSource,type ImageLine } from "./image-model";

const FONT_FILE=join(process.cwd(),"public/fonts/Pretendard-Regular.otf");
// Match the existing Stitch tier tokens in stitch.css; images use a fixed light
// palette so sharing is independent of the viewer's local theme.
const colors={
  S:{bg:"#7e22ce",ink:"#fde047",row:"#faf5ff"},A:{bg:"#1e3a8a",ink:"#ffffff",row:"#eff6ff"},
  B:{bg:"#065f46",ink:"#ffffff",row:"#ecfdf5"},C:{bg:"#c2410c",ink:"#ffffff",row:"#fff7ed"},
  D:{bg:"#575e70",ink:"#ffffff",row:"#f0f3ff"},F:{bg:"#151c27",ink:"#ffb4ab",row:"#ffffff"},
};
const ink="#151c27",muted="#575e70",paper="#ffffff",accent="#006e2e";
type TextLayer={value:string;x:number;y:number;width:number;height:number;size:number;color?:string;max?:number};

async function canvas(width:number,height:number,rects:string[],texts:TextLayer[],signal?:AbortSignal) {
  signal?.throwIfAborted();
  // The SVG contains only code-owned rectangles. All user text goes through
  // escaped local Pango text; no ImageResponse font fallback or remote fetch.
  const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects.join("")}</svg>`);
  const overlays:OverlayOptions[]=[{input:svg,top:0,left:0}];
  for (let i=0;i<texts.length;i+=4) {
    signal?.throwIfAborted();
    const batch=await Promise.all(texts.slice(i,i+4).map(async t=>{
      const value=escapeImageText(imageText(t.value,t.max ?? 80));
      if (!value.trim()) return null;
      const input=await sharp({text:{text:`<span foreground="${t.color ?? ink}">${value}</span>`,
        font:`Pretendard ${t.size}`,fontfile:FONT_FILE,width:t.width,wrap:"char",rgba:true,dpi:72}})
        .resize(t.width,t.height,{fit:"inside",withoutEnlargement:true}).timeout({seconds:4}).png().toBuffer();
      return {input,top:t.y,left:t.x};
    }));
    for(const overlay of batch) if (overlay) overlays.push(overlay);
  }
  signal?.throwIfAborted();
  return sharp({create:{width,height,channels:4,background:paper}}).composite(overlays).timeout({seconds:8}).png().toBuffer();
}
function rect(x:number,y:number,w:number,h:number,color:string,r=0) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${color}"/>`;
}
function imageRows(lines:ImageLine[],top:number) {
  const rects:string[]=[],texts:TextLayer[]=[];
  for(const [i,line] of lines.entries()) {
    const y=top+i*184;
    const color=colors[line.colorToken];
    rects.push(rect(40,y,1120,172,color.row,8),rect(40,y,120,172,color.bg,8));
    texts.push({value:line.label,x:52,y:y+48,width:96,height:60,size:24,max:12,color:color.ink});
    if (line.continued) texts.push({value:"계속",x:52,y:y+118,width:90,height:24,size:16,color:color.ink});
    if (!line.items.length) texts.push({value:"비어 있음",x:184,y:y+68,width:300,height:36,size:22,color:muted});
    for(const [j,item] of line.items.entries()) {
      const x=176+j*140;
      rects.push(rect(x,y+12,128,148,item ? "#f0f3ff" : "#e5e7eb",8),rect(x+10,y+24,24,4,accent));
      texts.push({value:item?.title ?? "제공할 수 없는 작품",x:x+10,y:y+45,width:108,height:102,size:20,max:60});
    }
  }
  return {rects,texts};
}
export async function renderTierPngs(source:TierImageSource,signal?:AbortSignal) {
  const pages=paginateTierImage(source),images:Buffer[]=[];
  if (pages.length > 8) throw new Error("Image page limit");
  let total=0;
  for(const [index,lines] of pages.entries()) {
    const height=236+lines.length*184+68,rows=imageRows(lines,236);
    const image=await canvas(1200,height,[rect(40,32,36,36,accent,8),...rows.rects],[
      {value:"T",x:49,y:36,width:22,height:30,size:25,color:paper},
      {value:"ToonShelf",x:88,y:36,width:500,height:32,size:26},
      {value:source.source === "draft" ? "비공개 초안" : "게시본",x:890,y:40,width:270,height:26,size:19,color:muted},
      {value:source.body.title,x:40,y:92,width:1120,height:50,size:34,max:80},
      {value:source.body.description,x:40,y:150,width:1120,height:44,size:17,color:muted,max:120},
      {value:source.body.tags.map(t=>"#"+t).join("  "),x:40,y:204,width:900,height:24,size:16,color:accent,max:110},
      ...rows.texts,
      {value:`${index+1} / ${pages.length} · ${source.isSpoiler ? "스포일러 주의 · " : ""}텍스트 표지 · 개인 평가와 별개`,x:40,y:height-43,width:1120,height:26,size:16,color:muted,max:100},
    ],signal);
    total+=image.length;if (total > 16*1024*1024) throw new Error("Image byte limit");images.push(image);
  }
  return images;
}

export async function renderTierOg(source:TierImageSource|null,signal?:AbortSignal) {
  // Null means generic branding (spoiler/unlisted); no IDs, labels, placements,
  // descriptions, author names or work titles enter that output.
  const texts:TextLayer[]=[
    {value:"ToonShelf",x:48,y:42,width:700,height:42,size:34,color:accent},
    {value:source?.body.title ?? "웹툰 취향을 담은 티어표",x:48,y:112,width:1100,height:82,size:46,max:60},
    {value:source ? "취향을 나누고, 다음 작품을 발견해요." : "스포일러와 티어 배치는 링크에서 직접 확인해요.",x:48,y:211,width:1100,height:36,size:23,color:muted},
    {value:source ? "TOONSHELF · 일부 행 미리보기 · 현재 표는 링크에서 확인해요" : "TOONSHELF · TASTE MAP",x:48,y:570,width:1100,height:28,size:18,color:muted},
  ];
  const rects=[rect(0,0,1200,8,accent)];
  if (source) {
    for(const [i,row] of source.body.rows.slice(0,3).entries()) {
      const y=290+i*80,color=colors[row.colorToken];rects.push(rect(48,y,1104,68,color.row,8),rect(48,y,110,68,color.bg,8));
      texts.push({value:row.label,x:60,y:y+18,width:86,height:34,size:24,max:12,color:color.ink});
      texts.push({value:row.items.slice(0,4).map(w=>w?.title ?? "제공할 수 없는 작품").join(" · ") || "비어 있음",x:180,y:y+20,width:946,height:32,size:22,max:70});
    }
  } else {
    for(let i=0;i<6;i++) rects.push(rect(48+i*184,320,164,176,Object.values(colors)[i]!.bg,8));
    texts.push({value:"공유 페이지에서 현재 게시본을 확인해 주세요.",x:48,y:520,width:1100,height:28,size:20,color:muted});
  }
  return canvas(1200,630,rects,texts,signal);
}

// Only this fixed public brand card is reused across requests. Per-tier images
// and private exports are never stored in shared memory or on disk.
let genericCard:Promise<Buffer>|undefined;
export function genericTierOg() {
  genericCard ??= renderTierOg(null).catch(error=>{genericCard=undefined;throw error;});
  return genericCard;
}
