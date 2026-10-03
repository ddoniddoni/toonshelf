"use client";
import { useEffect,useRef,useState } from "react";

type Download={url:string;filename:string;blob:Blob;pages:number};
export function TierImageExport({id,version,source,token=null,isSpoiler=false,disabled=false}:{
  id:string;version:number;source:"draft"|"publication";token?:string|null;isSpoiler?:boolean;disabled?:boolean;
}) {
  const [busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false),[spoiler,setSpoiler]=useState(false);
  const [message,setMessage]=useState(""),[download,setDownload]=useState<Download|null>(null);
  const controller=useRef<AbortController|null>(null),urlRef=useRef<string|null>(null);
  useEffect(()=>{
    setDownload(null);setBusy(false);setMessage("");setConfirmed(false);setSpoiler(false);
    return ()=>{controller.current?.abort();controller.current=null;if (urlRef.current) URL.revokeObjectURL(urlRef.current);urlRef.current=null;};
  },[id,version,source,token,disabled,isSpoiler]);
  async function prepare() {
    if (busy || disabled || !confirmed || (isSpoiler && !spoiler)) return;
    const request=new AbortController();controller.current=request;setBusy(true);setMessage("");setDownload(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);urlRef.current=null;
    try {
      const response=await fetch(`/api/tiers/${id}/export`,{method:"POST",credentials:"same-origin",mode:"same-origin",cache:"no-store",signal:request.signal,
        headers:{"Content-Type":"application/json"},body:JSON.stringify({source,version,token,confirm:true,confirmSpoiler:spoiler})});
      if (!response.ok) {
        const result:unknown=await response.json();
        const error=result && typeof result === "object" && "error" in result ? result.error : null;
        const text=error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "파일을 만들지 못했어요. 다시 시도해 주세요.";
        if (!request.signal.aborted) setMessage(text);return;
      }
      const type=response.headers.get("content-type");if (type !== "image/png" && type !== "application/zip") throw new Error("Unexpected image response");
      const blob=await response.blob(),pages=Number(response.headers.get("x-toonshelf-pages"));
      if (!blob.size || blob.size > 17*1024*1024 || !Number.isInteger(pages) || pages < 1 || pages > 8) throw new Error("Image response limit");
      if (request.signal.aborted) return;
      const url=URL.createObjectURL(blob);urlRef.current=url;
      setDownload({url,blob,pages,filename:`toonshelf-${source}-v${version}.${type === "application/zip" ? "zip" : "png"}`});
      setMessage(pages > 1 ? `${pages}장의 PNG를 ZIP 파일로 준비했어요. 아래에서 저장해 주세요.` : "PNG 파일을 준비했어요. 아래에서 저장해 주세요.");
    } catch(error) {if (!request.signal.aborted) setMessage(error instanceof Error && error.name === "AbortError" ? "파일 만들기를 취소했어요." : "연결을 확인하고 파일을 다시 만들어 주세요.");}
    finally {if (controller.current === request) {controller.current=null;setBusy(false);}}
  }
  async function share() {
    if (!download) return;
    const file=new File([download.blob],download.filename,{type:download.blob.type});
    if (!navigator.canShare?.({files:[file]}) || !navigator.share) {setMessage("이 브라우저에서는 파일을 저장한 뒤 공유해 주세요.");return;}
    try {await navigator.share({files:[file],title:"ToonShelf 티어표 이미지"});}
    catch(error) {if (!(error instanceof Error && error.name === "AbortError")) setMessage("파일을 저장한 뒤 공유해 주세요.");}
  }
  return <section className="tier-image-export" aria-busy={busy}><h2>{source === "draft" ? "저장된 초안 PNG" : "게시본 PNG"}</h2>
    <p>{source === "draft" ? "서버에 마지막으로 저장한 초안과 미배치 작품을 이미지로 만들어요." : "현재 접근할 수 있는 게시본을 이미지로 만들어요."} 큰 표는 여러 장의 PNG를 ZIP으로 묶어요.</p>
    <p className="field-hint">작품은 텍스트 표지로 표시해요. 파일에는 이미지 생성 시점의 내용이 담기며, 이후 비공개 전환이나 링크 철회로 이미 저장한 파일을 회수할 수는 없어요.</p>
    {disabled ? <p className="field-hint">초안을 먼저 저장하면 PNG 파일을 만들 수 있어요.</p> : null}
    <label className="form-checkbox"><input type="checkbox" checked={confirmed} disabled={disabled || busy} onChange={e=>setConfirmed(e.target.checked)}/><span>저장할 내용과 공유할 범위를 확인했어요.</span></label>
    {isSpoiler ? <label className="form-checkbox"><input type="checkbox" checked={spoiler} disabled={disabled || busy} onChange={e=>setSpoiler(e.target.checked)}/><span>스포일러가 담긴 제목·배치를 PNG에 포함하는 데 동의해요.</span></label> : null}
    <div className="tier-list-actions"><button type="button" className="button button-secondary" onClick={prepare} disabled={disabled || busy || !confirmed || (isSpoiler && !spoiler)}>{busy ? "파일 만드는 중…" : "PNG 파일 만들기"}</button>
      {busy ? <button type="button" className="button button-secondary" onClick={()=>controller.current?.abort()}>취소</button> : null}
      {download && !disabled ? <><a className="button button-primary" href={download.url} download={download.filename}>{download.pages > 1 ? `PNG ${download.pages}장 ZIP 저장` : "PNG 저장"}</a><button type="button" className="button button-secondary" onClick={share}>이미지 기기 공유</button></> : null}
    </div><p role="status" aria-live="polite">{message}</p><p className="field-hint">회원별로 10분 구간당 최대 5번 만들 수 있어요.</p>
  </section>;
}
