import { describe,expect,it } from "vitest";
import { defaultDraft,draftSchema } from "@/lib/tiers/model";
import { addWork,change,moveWork,redo,removeRow,reorderRow,undo,type History } from "@/lib/tiers/operations";
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const draft=()=>{let n=0;return defaultDraft(()=>id(++n));};
describe("private tier draft contracts",()=>{
 it("counts Unicode code points and keeps custom labels independent of canonical codes",()=>{
  const value=draft();value.title="😀".repeat(80);value.rows[0]={...value.rows[0],label:"S급",canonicalTier:null};
  expect(draftSchema.parse(value).rows[0].canonicalTier).toBeNull();
  expect(draftSchema.safeParse({...value,title:"😀".repeat(81)}).success).toBe(false);
 });
 it("rejects duplicates, unknown fields, broken row references and noncontiguous positions",()=>{
  const value=addWork(draft(),id(100));
  for (const invalid of [{...value,ownerId:id(99)},{...value,tags:["중복","중복"]},{...value,placements:[...value.placements,...value.placements]},
   {...value,placements:[{workId:id(100),rowId:id(99),position:0}]},{...value,placements:[{workId:id(100),rowId:null,position:1}]},
   {...value,rows:value.rows.map((r,i)=>i === 1 ? {...r,canonicalTier:"S"} : r)}]) expect(draftSchema.safeParse(invalid).success).toBe(false);
 });
 it("requires two to ten rows and at most 300 works",()=>{
  const value=draft();expect(draftSchema.safeParse({...value,rows:value.rows.slice(0,1)}).success).toBe(false);
  const placements=Array.from({length:301},(_,i)=>({workId:id(i+100),rowId:null,position:i}));
  expect(draftSchema.safeParse({...value,placements:placements.slice(0,300)}).success).toBe(true);
  expect(draftSchema.safeParse({...value,placements}).success).toBe(false);
 });
 it("uses the same operation for drag, menu and keyboard and preserves works when removing a row",()=>{
  let value=addWork(addWork(addWork(draft(),id(100)),id(101)),id(102));
  value=moveWork(value,id(100),value.rows[0].id);value=moveWork(value,id(101),value.rows[0].id,0);
  expect(value.placements.filter(p=>p.rowId === value.rows[0].id).map(p=>p.workId)).toEqual([id(101),id(100)]);
  const removed=removeRow(value,value.rows[0].id);expect(removed.placements).toHaveLength(3);
  expect(removed.placements.map(p=>p.position)).toEqual([0,1,2]);expect(draftSchema.safeParse(removed).success).toBe(true);
  expect(addWork(removed,id(100))).toBe(removed);
  expect(reorderRow(removed,removed.rows[0].id,-1)).toBe(removed);
 });
 it("keeps fifty undo states, clears redo on edits and contains no server version",()=>{
  let history:History={past:[],present:draft(),future:[]};
  for (let n=0;n<60;n++) history=change(history,{...history.present,title:String(n)});
  expect(history.past).toHaveLength(50);const back=undo(history);expect(redo(back).present).toEqual(history.present);
  expect(change(back,{...back.present,title:"새 편집"}).future).toEqual([]);expect(history.present).not.toHaveProperty("version");
 });
});
