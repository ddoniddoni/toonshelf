import type { TierDraft } from "./model";

export function normalize(draft:TierDraft):TierDraft {
 const placements = [null,...draft.rows.map(r=>r.id)].flatMap(rowId=>draft.placements.filter(p=>p.rowId === rowId).sort((a,b)=>a.position-b.position).map((p,position)=>({...p,position})));
 return {...draft,placements};
}
export function moveWork(draft:TierDraft,workId:string,rowId:string|null,position?:number):TierDraft {
 if (!draft.placements.some(p=>p.workId === workId) || (rowId !== null && !draft.rows.some(r=>r.id === rowId))) return draft;
 const remaining = draft.placements.filter(p=>p.workId !== workId);
 const row = remaining.filter(p=>p.rowId === rowId).sort((a,b)=>a.position-b.position);
 row.splice(Math.max(0,Math.min(position ?? row.length,row.length)),0,{workId,rowId,position:0});
 return normalize({...draft,placements:[...remaining.filter(p=>p.rowId !== rowId),...row.map((p,i)=>({...p,position:i}))]});
}
export function addWork(draft:TierDraft,workId:string):TierDraft {
 if (draft.placements.length >= 300 || draft.placements.some(p=>p.workId === workId)) return draft;
 return normalize({...draft,placements:[...draft.placements,{workId,rowId:null,position:draft.placements.filter(p=>p.rowId === null).length}]});
}
export function removeWork(draft:TierDraft,workId:string):TierDraft {
 return normalize({...draft,placements:draft.placements.filter(p=>p.workId !== workId)});
}
export function removeRow(draft:TierDraft,id:string):TierDraft {
 if (draft.rows.length <= 2) return draft;
 const offset = draft.placements.filter(p=>p.rowId === null).length;
 return normalize({...draft,rows:draft.rows.filter(r=>r.id !== id),placements:draft.placements.map(p=>p.rowId === id ? {...p,rowId:null,position:p.position+offset} : p)});
}
export function reorderRow(draft:TierDraft,id:string,delta:number):TierDraft {
 const rows = [...draft.rows],from = rows.findIndex(r=>r.id === id),to = from+delta;
 if (from < 0 || to < 0 || to >= rows.length) return draft;
 const [row] = rows.splice(from,1);rows.splice(to,0,row);return normalize({...draft,rows});
}
export type History = {past:TierDraft[];present:TierDraft;future:TierDraft[]};
export function change(history:History,next:TierDraft):History {
 if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
 return {past:[...history.past,history.present].slice(-50),present:next,future:[]};
}
export function undo(history:History):History {
 const previous = history.past.at(-1);return previous ? {past:history.past.slice(0,-1),present:previous,future:[history.present,...history.future].slice(0,50)} : history;
}
export function redo(history:History):History {
 const next = history.future[0];return next ? {past:[...history.past,history.present].slice(-50),present:next,future:history.future.slice(1)} : history;
}
