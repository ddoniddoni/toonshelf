import { z } from "zod";
import { cardSchema, uuidSchema } from "@/lib/catalogue/model";

export const tierCodes = ["S","A","B","C","D","F"] as const;
export const codeSchema = z.enum(tierCodes);
const text = (min:number,max:number) => z.string().refine(v=>Array.from(v).length >= min && Array.from(v).length <= max,`${min}~${max}자로 입력해 주세요.`);
export const versionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const rowSchema = z.strictObject({id:uuidSchema,label:text(1,12),colorToken:codeSchema,canonicalTier:codeSchema.nullable()});
export const placementSchema = z.strictObject({workId:uuidSchema,rowId:uuidSchema.nullable(),position:z.number().int().min(0).max(299)});
export const draftSchema = z.strictObject({title:text(1,80),description:text(0,1000),tags:z.array(text(1,20)).max(5),rows:z.array(rowSchema).min(2).max(10),placements:z.array(placementSchema).max(300)})
 .superRefine((v,ctx)=>{
  const issue = (message:string)=>ctx.addIssue({code:"custom",message});
  if (new TextEncoder().encode(JSON.stringify(v)).length > 256*1024) issue("초안은 256KiB 이하로 저장해 주세요.");
  if (new Set(v.tags).size !== v.tags.length) issue("태그가 중복됐어요.");
  if (new Set(v.rows.map(r=>r.id)).size !== v.rows.length) issue("행 식별자가 중복됐어요.");
  const codes = v.rows.flatMap(r=>r.canonicalTier === null ? [] : [r.canonicalTier]);
  if (new Set(codes).size !== codes.length) issue("기본 티어 코드는 행마다 다르게 지정해 주세요.");
  if (new Set(v.placements.map(p=>p.workId)).size !== v.placements.length) issue("같은 작품은 한 번만 배치할 수 있어요.");
  if (v.placements.some(p=>p.rowId !== null && !v.rows.some(r=>r.id === p.rowId))) issue("배치할 행을 확인해 주세요.");
  for (const rowId of [null,...v.rows.map(r=>r.id)]) {
   const positions = v.placements.filter(p=>p.rowId === rowId).map(p=>p.position).sort((a,b)=>a-b);
   if (positions.some((p,i)=>p !== i)) issue("행 안의 작품 순서를 확인해 주세요.");
  }
 });
export type TierDraft = z.infer<typeof draftSchema>;
export type TierRow = z.infer<typeof rowSchema>;
export const saveInputSchema = z.strictObject({tierListId:uuidSchema,expectedVersion:versionSchema,draft:draftSchema});
export const mergeNoticeSchema=z.object({id:uuidSchema,sourceId:uuidSchema,targetId:uuidSchema,sourceTitle:z.string(),targetTitle:z.string(),createdAt:z.string(),duplicatesRemoved:z.number().int().nonnegative(),draftBefore:draftSchema});
export type TierMergeNotice=z.infer<typeof mergeNoticeSchema>;
export const mergeHistorySchema=z.object({items:z.array(mergeNoticeSchema),hasNext:z.boolean()});
export const editorSchema = z.object({id:uuidSchema,version:versionSchema,savedAt:z.string(),draft:draftSchema,
 works:z.array(z.object({workId:uuidSchema,work:cardSchema.nullable()})),mergeNotices:z.array(mergeNoticeSchema)});
export type TierEditorData = z.infer<typeof editorSchema>;
export const listSchema = z.object({items:z.array(z.object({id:uuidSchema,title:z.string(),description:z.string(),tags:z.array(z.string()),workCount:z.number().int().nonnegative(),version:versionSchema,savedAt:z.string()})),hasNext:z.boolean()});
export const pickerInputSchema = z.strictObject({origin:z.enum(["library","catalogue"]),q:text(0,100),page:z.number().int().min(1).max(1000)});
export const pickerSchema = z.object({items:z.array(cardSchema),hasNext:z.boolean()});
const worksSchema=z.array(z.object({workId:uuidSchema,work:cardSchema.nullable()})).max(300);
export type TierWorks=z.infer<typeof worksSchema>;
export type SaveReply = {ok:true;version:number;savedAt:string;draft:TierDraft;works:TierWorks} | {ok:false;error:{code:string;message:string};conflict?:{version:number;savedAt:string}};
export const saveReplySchema = z.union([
 z.object({ok:z.literal(true),version:versionSchema,savedAt:z.string(),draft:draftSchema,works:worksSchema}),
 z.object({ok:z.literal(false),conflict:z.object({version:versionSchema,savedAt:z.string()})})
]);
export function defaultDraft(id:()=>string):TierDraft {
 return {title:"나만의 웹툰 티어표",description:"",tags:[],rows:tierCodes.map(code=>({id:id(),label:code,colorToken:code,canonicalTier:code})),placements:[]};
}
