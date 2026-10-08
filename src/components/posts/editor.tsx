"use client";
import { useEffect,useId,useState,useTransition } from "react";
import { ActionForm,Checkbox,Field } from "@/components/forms/action-form";
import { publishPost,savePostDraft,searchPostWorks,withdrawPost } from "@/lib/posts/actions";
import { categoryLabels,categorySchema,publishPayloadSchema,type PostEditor,type WorkOption } from "@/lib/posts/model";
import { PostContent } from "./post-content";
export function PostEditorForms({editor}:{editor:PostEditor}) {
 const [title,setTitle]=useState(editor.draft.title),[body,setBody]=useState(editor.draft.body),[category,setCategory]=useState(editor.draft.category),[spoiler,setSpoiler]=useState(editor.draft.isSpoiler);
 const [selected,setSelected]=useState(()=>editor.works.map(w=>({id:w.id,title:w.card?.title ?? "현재 제공할 수 없는 작품",slug:w.card?.slug ?? ""})));
 const [query,setQuery]=useState(""),[results,setResults]=useState<WorkOption[]>([]),[message,setMessage]=useState(""),[pending,startTransition]=useTransition();
 const bodyId=useId(),categoryId=useId(),queryId=useId();
 const dirty=title!==editor.draft.title || body!==editor.draft.body || category!==editor.draft.category || spoiler!==editor.draft.isSpoiler || selected.map(w=>w.id).join(",")!==editor.draft.workIds.join(",");
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[dirty]);
 const publishable=publishPayloadSchema.safeParse(editor.draft).success && editor.moderationStatus==="visible" && editor.works.every(w=>w.card!==null);
 const identity=<><input type="hidden" name="id" value={editor.id}/><input type="hidden" name="postVersion" value={editor.postVersion}/></>;
 return <div className="review-editor-forms">
 <section><h2>함께 이야기할 작품</h2><p>최대 5개까지 연결할 수 있어요. 선택한 작품도 초안 저장을 눌러야 저장돼요.</p>
 <form className="post-work-search" onSubmit={event=>{event.preventDefault();startTransition(async()=>{try{const result=await searchPostWorks(query);if(result.ok){setResults(result.items);setMessage(result.items.length ? "" : "일치하는 공개 작품이 없어요.");}else{setResults([]);setMessage(result.message);}}catch{setMessage("작품 검색에 실패했어요. 다시 시도해 주세요.");}});}} aria-busy={pending}>
 <label htmlFor={queryId}>작품 제목·작가 검색</label><input id={queryId} type="search" value={query} onChange={e=>setQuery(e.target.value)} minLength={2} maxLength={100} required disabled={pending}/><button className="button button-secondary" disabled={pending}>{pending ? "찾는 중…" : "작품 찾기"}</button></form>
 <p role="status">{message}</p><ul className="post-picker-list">{results.map(work=><li key={work.id}><span>{work.title}</span><button type="button" className="button button-secondary" disabled={selected.length>=5 || selected.some(w=>w.id===work.id)} onClick={()=>setSelected(previous=>previous.length>=5 || previous.some(w=>w.id===work.id) ? previous : [...previous,work])}>{selected.some(w=>w.id===work.id) ? "선택됨" : "작품 추가"}</button></li>)}</ul>
 <h3>선택한 작품 {selected.length}/5</h3><ul className="post-picker-list">{selected.map(work=><li key={work.id}><span>{work.title}</span><button type="button" className="text-link" aria-label={`${work.title} 연결 제거`} onClick={()=>setSelected(previous=>previous.filter(w=>w.id!==work.id))}>제거</button></li>)}</ul></section>
 <section><h2>비공개 수정 초안</h2><p>초안 저장 후 아래에서 게시해 주세요. 저장하지 않은 입력은 다른 페이지로 이동하면 사라질 수 있어요.</p>
 <ActionForm action={savePostDraft} submitLabel="비공개 초안 저장"><input type="hidden" name="id" value={editor.id}/><input type="hidden" name="draftVersion" value={editor.draftVersion}/>{selected.map(w=><input key={w.id} type="hidden" name="workId" value={w.id}/>)}
 <div className="form-field"><label htmlFor={categoryId}>주제</label><select name="category" id={categoryId} value={category} onChange={e=>setCategory(categorySchema.parse(e.target.value))}>{Object.entries(categoryLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
 <Field name="title" label="제목 (게시할 때 5~100자)" value={title} onChange={e=>setTitle(e.target.value)} maxLength={200}/>
 <div className="form-field"><label htmlFor={bodyId}>본문 (게시할 때 20~10000자)</label><textarea id={bodyId} className="post-body-input" name="body" value={body} onChange={e=>setBody(e.target.value)} maxLength={20000} rows={14}/></div>
 <label className="form-checkbox"><input name="isSpoiler" type="checkbox" checked={spoiler} onChange={e=>setSpoiler(e.target.checked)}/><span>제목이나 본문에 스포일러가 포함돼요</span></label>
 <p className="field-hint" role="status">{dirty ? "저장하지 않은 변경이 있어요." : "마지막으로 저장한 초안이에요."}</p></ActionForm></section>
 <section className="review-publish-panel"><h2>저장된 초안 게시</h2><p>현재 입력 중인 내용은 포함되지 않아요. 먼저 위에서 초안을 저장해 주세요.</p>
 <details><summary>저장된 초안 미리보기 · {editor.draft.isSpoiler ? "스포일러 포함" : "스포일러 없음"}</summary><PostContent title={editor.draft.title || "제목 없음"} body={editor.draft.body} works={editor.works.flatMap(w=>w.card ? [w.card] : [])}/></details>
 {publishable && !dirty ? <ActionForm action={publishPost} submitLabel={editor.publicationStatus==="published" ? "게시본 업데이트" : "글 공개 게시"}>{identity}<input type="hidden" name="draftVersion" value={editor.draftVersion}/><Checkbox name="confirm" required label="저장된 제목·본문·작품과 스포일러 표시를 확인하고 공개할게요"/></ActionForm> : <p className="reading-warning">{dirty ? "입력한 변경을 먼저 저장해 주세요." : editor.moderationStatus==="hidden" ? "운영자가 숨긴 글은 직접 다시 게시할 수 없어요." : "제목 5자·본문 20자 이상을 저장하고, 제공 불가 작품을 제거해 주세요."}</p>}</section>
 {editor.publicationStatus==="published" ? <details><summary>현재 게시본 · 공개 취소</summary><PostContent title={editor.publishedTitle} body={editor.publishedBody} works={[]}/><ActionForm action={withdrawPost} submitLabel="글 공개 취소">{identity}<input type="hidden" name="operation" value="unpublish"/><Checkbox name="confirm" required label="글을 비공개로 바꾸고 초안은 유지할게요"/></ActionForm></details> : null}
 <details className="library-privacy-panel"><summary>글 삭제</summary><ActionForm action={withdrawPost} submitLabel="글과 초안 삭제">{identity}<input type="hidden" name="operation" value="delete"/><Checkbox name="confirm" required label="제목·본문·초안·작품 연결을 삭제할게요. 되돌릴 수 없어요."/></ActionForm></details>
 </div>;
}
