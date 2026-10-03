"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition,useEffect,useRef,useState,type DragEvent,type KeyboardEvent } from "react";
import { ArrowDown,ArrowLeft,ArrowUp,BookOpen,Plus,Redo2,Save,Settings2,Trash2,Undo2 } from "lucide-react";
import { WorkCover } from "@/components/catalogue/work-cover";
import type { WorkCard } from "@/lib/catalogue/model";
import { reloadTierDraft,saveTierAsNew,saveTierDraft } from "@/lib/tiers/actions";
import { codeSchema,draftSchema,tierCodes,type TierDraft,type TierEditorData,type TierRow } from "@/lib/tiers/model";
import { addWork,change,moveWork,redo,removeRow,removeWork,reorderRow,undo,type History } from "@/lib/tiers/operations";
import { DraftSaveQueue,type SaveState } from "@/lib/tiers/save-queue";
import { TierWorkPicker } from "./work-picker";
import { TierMergeNoticeView } from "./merge-notice";
import { TierImageExport } from "./image-export";

export function TierDraftEditor({initial}:{initial:TierEditorData}) {
 const router=useRouter();const initialRef=useRef(initial);
 const [history,setHistory]=useState<History>({past:[],present:initial.draft,future:[]});
 const historyRef=useRef(history);
 const [works,setWorks]=useState<Record<string,WorkCard|null>>(()=>Object.fromEntries(initial.works.map(w=>[w.workId,w.work])));
 const [notices,setNotices]=useState(initial.mergeNotices),[save,setSave]=useState<SaveState>({dirty:false,saving:false,version:initial.version,savedAt:initial.savedAt,failure:null});
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[tags,setTags]=useState(initial.draft.tags.join("\n"));
 const queue=useRef<DraftSaveQueue|null>(null),dragged=useRef<string|null>(null);
 const draft=history.present;
 useEffect(()=>{
  const value=initialRef.current;
  const controller=new DraftSaveQueue(value.draft,value.version,value.savedAt,(next,version)=>new Promise((resolve,reject)=>startTransition(async()=>{try {resolve(await saveTierDraft({tierListId:value.id,expectedVersion:version,draft:next}));} catch(error) {reject(error);}})),
   (state,canonical,cards)=>{setSave(state);if (cards) setWorks(current=>({...current,...Object.fromEntries(cards.map(w=>[w.workId,w.work]))}));if (canonical) {const next={...historyRef.current,present:canonical};historyRef.current=next;setHistory(next);}});
  queue.current=controller;controller.update(historyRef.current.present);return ()=>{controller.dispose();queue.current=null;};
 },[]);
 useEffect(()=>{
  const leaving=(event:BeforeUnloadEvent)=>{if (save.dirty || save.saving || busy) {event.preventDefault();event.returnValue="";}};
  const navigation=(event:MouseEvent)=>{
   const target=event.target;if (!(target instanceof Element)) return;
   const anchor=target.closest("a[href]");if (!anchor || anchor.getAttribute("href")?.startsWith("#") || anchor.getAttribute("target") === "_blank") return;
   if ((save.dirty || save.saving || busy) && !window.confirm("아직 저장하지 못한 변경 내용이 있어요. 이 화면을 떠날까요?")) {event.preventDefault();event.stopPropagation();}
  };
  const submit=(event:Event)=>{if ((save.dirty || save.saving || busy) && !window.confirm("저장하지 못한 변경 내용이 있어요. 이 작업을 계속할까요?")) {event.preventDefault();event.stopPropagation();}};
  const traversal=(event:Event)=>{const nav=event as Event & {navigationType?:string};if (nav.navigationType === "traverse" && event.cancelable && (save.dirty || save.saving || busy) && !window.confirm("저장하지 못한 변경 내용이 있어요. 이전 화면으로 이동할까요?")) event.preventDefault();};
  const navigationApi=(window as Window & {navigation?:EventTarget}).navigation;
  window.addEventListener("beforeunload",leaving);document.addEventListener("click",navigation,true);document.addEventListener("submit",submit,true);navigationApi?.addEventListener("navigate",traversal);
  return ()=>{window.removeEventListener("beforeunload",leaving);document.removeEventListener("click",navigation,true);document.removeEventListener("submit",submit,true);navigationApi?.removeEventListener("navigate",traversal);};
 },[save.dirty,save.saving,busy]);
 // Inform the queue in the input event, before React commits. A response that
 // arrives before an effect runs must still see the newly edited revision.
 function applyHistory(next:History) {historyRef.current=next;queue.current?.update(next.present);setHistory(next);}
 function edit(operation:(current:TierDraft)=>TierDraft) {if (!busy) applyHistory(change(historyRef.current,operation(historyRef.current.present)));}
 function travel(direction:"undo"|"redo") {const current=historyRef.current,next=direction === "undo" ? undo(current) : redo(current);setTags(next.present.tags.join("\n"));applyHistory(next);}
 function add(work:WorkCard) {if (busy) return;setWorks(current=>({...current,[work.id]:work}));edit(d=>addWork(d,work.id));setMessage(work.title+"을 미배치에 추가했어요.");}
 function addRow() {const id=crypto.randomUUID();edit(d=>d.rows.length >= 10 ? d : {...d,rows:[...d.rows,{id,label:"새 행",colorToken:"D",canonicalTier:null}]});}
 function drop(event:DragEvent,rowId:string|null,position?:number) {event.preventDefault();event.stopPropagation();const id=dragged.current;dragged.current=null;if (id) {edit(d=>moveWork(d,id,rowId,position));setMessage("작품 배치를 바꿨어요.");}}
 function keyboard(event:KeyboardEvent,workId:string,rowId:string|null,position:number) {
  if (!event.altKey) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {event.preventDefault();edit(d=>moveWork(d,workId,rowId,position+(event.key === "ArrowLeft" ? -1 : 1)));}
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {event.preventDefault();const ids=[null,...draft.rows.map(r=>r.id)],to=ids.indexOf(rowId)+(event.key === "ArrowUp" ? -1 : 1);if (to >= 0 && to < ids.length) edit(d=>moveWork(d,workId,ids[to]));}
 }
 function patchRow(id:string,patch:Partial<TierRow>) {edit(d=>({...d,rows:d.rows.map(r=>r.id === id ? {...r,...patch} : r)}));}
 function setCanonical(id:string,value:string) {
  const code=value === "" ? null : codeSchema.parse(value);
  if (code && draft.rows.some(r=>r.id !== id && r.canonicalTier === code)) {setMessage("그 기본 티어 코드는 다른 행에서 사용 중이에요.");return;}
  patchRow(id,{canonicalTier:code});
 }
 function reload() {
  if (save.saving || busy || !window.confirm("지금 편집 중인 내용 대신 서버에 저장된 최신 초안을 불러올까요?")) return;
  setBusy(true);startTransition(async()=>{
   try {const reply=await reloadTierDraft(initial.id);if (!reply.ok) {setMessage(reply.error.message);return;}
    const data=reply.data;queue.current?.reset(data.draft,data.version,data.savedAt);const next={past:[],present:data.draft,future:[]};historyRef.current=next;setHistory(next);setTags(data.draft.tags.join("\n"));setWorks(Object.fromEntries(data.works.map(w=>[w.workId,w.work])));setNotices(data.mergeNotices);setMessage("최신 초안을 불러왔어요.");
   } catch {setMessage("최신 초안을 불러오지 못했어요. 연결을 확인해 주세요.");} finally {setBusy(false);}
  });
 }
 function saveAsNew() {
  if (save.saving || busy) return;
  const parsed=draftSchema.safeParse(draft);if (!parsed.success) {setMessage(parsed.error.issues[0]?.message ?? "초안 내용을 확인해 주세요.");return;}
  setBusy(true);startTransition(async()=>{
   try {const reply=await saveTierAsNew({origin:initial.id,draft:parsed.data});if (!reply.ok) {setMessage(reply.error.message);setBusy(false);return;}
    queue.current?.dispose();setSave(s=>({...s,dirty:false,saving:false}));setBusy(false);router.push(`/tiers/${reply.id}/edit`);
   } catch {setMessage("새 티어표로 저장하지 못했어요. 다시 시도해 주세요.");setBusy(false);}
  });
 }
 function cards(rowId:string|null) {
  const placed=draft.placements.filter(p=>p.rowId === rowId).sort((a,b)=>a.position-b.position);
  return <div className="tier-placement-area" onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,rowId)}>{placed.length ? placed.map((p,i)=>{
   const work=works[p.workId];const title=work?.title ?? "현재 제공할 수 없는 작품";
   return <article className="tier-placed-work" key={p.workId} draggable={!busy} onDragStart={e=>{dragged.current=p.workId;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",p.workId);}} onDragEnd={()=>{dragged.current=null;}} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,rowId,i)}>
    <button type="button" className="tier-work-handle" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight" onKeyDown={e=>keyboard(e,p.workId,rowId,i)} aria-label={title+" 이동. Alt와 위아래 방향키로 행 이동, 좌우 방향키로 순서 이동"}><WorkCover title={title} assetId={work?.coverAssetId ?? null}/><strong>{title}</strong></button>
    <label className="sr-only" htmlFor={"move-"+p.workId}>{title} 배치할 행</label><select id={"move-"+p.workId} aria-label={title+" 배치할 행"} value={rowId ?? ""} disabled={busy} onChange={e=>edit(d=>moveWork(d,p.workId,e.target.value || null))}><option value="">미배치</option>{draft.rows.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select>
    <div className="tier-work-actions"><button type="button" disabled={busy || i === 0} onClick={()=>edit(d=>moveWork(d,p.workId,rowId,i-1))} aria-label={title+" 앞 순서로 이동"}>←</button><button type="button" disabled={busy || i === placed.length-1} onClick={()=>edit(d=>moveWork(d,p.workId,rowId,i+1))} aria-label={title+" 뒤 순서로 이동"}>→</button><button type="button" disabled={busy} onClick={()=>edit(d=>removeWork(d,p.workId))} aria-label={title+"을 티어표에서 제거"}><Trash2 size={12} aria-hidden="true"/></button></div>
   </article>;
  }) : <span className="tier-row-empty">여기로 작품을 옮겨 주세요</span>}</div>;
 }
 const validation=draftSchema.safeParse(draft);
 return <div className="tier-preview-page tier-editor"><section className="tier-preview-toolbar"><div className="page-container tier-toolbar-inner"><div className="tier-toolbar-title"><Link className="header-icon" href="/me/tiers" aria-label="내 티어표로 돌아가기"><ArrowLeft size={18} aria-hidden="true"/></Link><div><h1>{draft.title || "제목을 입력해 주세요"}</h1><p><span className="section-chip">비공개 초안</span><span role="status" aria-live="polite">{save.saving ? "저장 중…" : save.failure ? "저장하지 못했어요" : save.dirty ? "저장 대기 중" : "서버에 저장됨"}</span><time dateTime={save.savedAt}>{new Date(save.savedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time></p></div></div><div className="tier-toolbar-actions"><div className="tier-undo"><button disabled={busy || !history.past.length} aria-label="실행 취소" onClick={()=>travel("undo")}><Undo2 size={16} aria-hidden="true"/></button><button disabled={busy || !history.future.length} aria-label="다시 실행" onClick={()=>travel("redo")}><Redo2 size={16} aria-hidden="true"/></button></div><button className="button button-primary" disabled={busy || save.saving || !save.dirty || Boolean(save.failure?.conflict) || !validation.success} onClick={()=>queue.current?.manual()}><Save size={15} aria-hidden="true"/>지금 저장</button></div></div></section>
  <div className="page-container tier-studio"><p className="tier-editor-help">작품을 드래그하거나 작품 아래 행 메뉴로 옮겨 보세요. 이동 버튼에서 Alt+방향키도 사용할 수 있어요. 배치는 개인 별점·기본 평가를 바꾸지 않아요.</p>
   <div role="status" aria-live="polite" className="tier-editor-message">{message}</div>
   {save.failure ? <div className="tier-save-error" role="alert"><p>{save.failure.error.message}</p>{save.failure.conflict ? <><p>서버 버전 {save.failure.conflict.version} · 저장 시각 {new Date(save.failure.conflict.savedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</p><button className="button button-secondary" disabled={busy} onClick={reload}>최신 초안 불러오기</button><button className="button button-primary" disabled={busy || !validation.success} onClick={saveAsNew}>지금 편집본을 새 티어표로 저장</button></> : <button className="button button-secondary" disabled={busy || !validation.success} onClick={()=>queue.current?.manual()}>다시 저장</button>}</div> : null}
   {!validation.success ? <p role="alert" className="field-error">{validation.error.issues[0]?.message} 유효한 내용으로 고치면 저장할 수 있어요.</p> : null}
   <details className="tier-draft-details"><summary>제목·설명·태그 편집</summary><fieldset disabled={busy}><label>제목<input value={draft.title} maxLength={160} onChange={e=>edit(d=>({...d,title:e.target.value}))}/></label><label>설명<textarea value={draft.description} maxLength={2000} onChange={e=>edit(d=>({...d,description:e.target.value}))}/></label><label>태그 · 한 줄에 하나, 최대 5개<textarea value={tags} maxLength={210} onChange={e=>{setTags(e.target.value);edit(d=>({...d,tags:e.target.value.split(/\r?\n/).map(t=>t.trim()).filter(Boolean)}));}}/></label></fieldset></details>
   {notices.length ? <details className="tier-merge-notices"><summary>작품 병합 이력 · 최근 {notices.length}건의 원본 배치 확인</summary>{notices.map(n=><TierMergeNoticeView key={n.id} notice={n} titles={Object.fromEntries(Object.entries(works).flatMap(([id,work])=>work ? [[id,work.title]] : []))}/>)}<Link className="text-link" href={`/me/tiers/${initial.id}/merges`}>전체 병합 원본 보기 →</Link></details> : null}
   <div className="tier-preview-layout"><TierWorkPicker selected={draft.placements.map(p=>p.workId)} onAdd={add} disabled={busy}/><section className="tier-preview-board" aria-labelledby="tier-board-title"><div className="tier-board-heading"><h2 id="tier-board-title">메인 티어 그리드 <span>{draft.placements.length}/300 작품</span></h2><button disabled={busy || draft.rows.length >= 10} onClick={addRow}><Plus size={13} aria-hidden="true"/>행 추가</button></div>
    <div className="tier-board-rows">{draft.rows.map((row,i)=><div key={row.id}><div className="tier-preview-row" data-tier={row.colorToken}><div className="tier-row-label"><strong>{row.label}</strong><span>{row.canonicalTier ? "기본 티어 "+row.canonicalTier : "사용자 행"}</span></div>{cards(row.id)}<div className="tier-row-tools"><button disabled={busy || i === 0} aria-label={row.label+" 행 위로 이동"} onClick={()=>edit(d=>reorderRow(d,row.id,-1))}><ArrowUp size={14} aria-hidden="true"/></button><button disabled={busy || i === draft.rows.length-1} aria-label={row.label+" 행 아래로 이동"} onClick={()=>edit(d=>reorderRow(d,row.id,1))}><ArrowDown size={14} aria-hidden="true"/></button></div></div>
     <details className="tier-row-settings"><summary><Settings2 size={13} aria-hidden="true"/> {row.label} 행 설정</summary><fieldset disabled={busy}><label>행 이름<input value={row.label} maxLength={24} onChange={e=>patchRow(row.id,{label:e.target.value})}/></label><label>색상<select value={row.colorToken} onChange={e=>patchRow(row.id,{colorToken:codeSchema.parse(e.target.value)})}>{tierCodes.map(code=><option key={code} value={code}>{code} 색상</option>)}</select></label><label>기본 티어 코드<select value={row.canonicalTier ?? ""} onChange={e=>setCanonical(row.id,e.target.value)}><option value="">지정 안 함</option>{tierCodes.map(code=><option key={code} value={code}>{code}</option>)}</select></label><button className="button button-secondary" disabled={draft.rows.length <= 2} onClick={()=>{if (window.confirm("행을 삭제하고 안의 작품을 미배치로 옮길까요?")) edit(d=>removeRow(d,row.id));}}>행 삭제 · 작품은 미배치로</button></fieldset></details>
    </div>)}</div></section></div>
   <section className="tier-unplaced"><div><h2><BookOpen size={16} aria-hidden="true"/>미배치 작품 보관함 <span className="section-chip">{draft.placements.filter(p=>p.rowId === null).length}편</span></h2><p>배치할 행을 선택하거나 보드로 드래그해 주세요.</p></div>{cards(null)}<div className="tier-unplaced-footer"><span>미배치 작품은 게시본에서 제외되고 본인 초안 PNG에만 포함돼요.</span>{!save.dirty && !save.saving && !busy && !save.failure ? <div className="tier-list-actions"><Link className="button button-secondary" href={`/tiers/${initial.id}/evaluations`}>내 기본 티어 가져오기·반영</Link><Link className="button button-primary" href={`/tiers/${initial.id}/publish`}>저장된 초안 미리보기·게시</Link></div> : <span>초안을 저장하면 기본 평가 연결·게시·공유 설정으로 이동할 수 있어요.</span>}</div></section>
   <TierImageExport id={initial.id} version={save.version} source="draft" disabled={save.dirty || save.saving || busy || Boolean(save.failure) || !validation.success}/>
   <p className="field-hint">연결이 끊기면 이 화면에서 다시 저장해 주세요. 저장하지 못한 변경 내용은 화면을 닫으면 사라져요.</p>
  </div>
 </div>;
}
