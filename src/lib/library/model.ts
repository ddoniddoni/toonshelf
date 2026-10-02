import { z } from "zod";
import { cardSchema, uuidSchema, type SearchParams } from "@/lib/catalogue/model";

const text = (max:number) => z.string().refine(v=>Array.from(v).length <= max,`최대 ${max}자까지 입력해 주세요.`);
export const readingSchema = z.enum(["reading","completed","dropped","planned"]);
export const tierSchema = z.enum(["S","A","B","C","D","F"]);
export const visibilitySchema = z.enum(["public","private"]);
export const versionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const tagsSchema = z.array(text(20).refine(t=>t.length > 0 && t === t.trim())).max(20)
 .refine(tags=>new Set(tags).size === tags.length,"태그가 중복됐어요.");
export const recordPayloadSchema = z.strictObject({
 status:readingSchema,libraryVisibility:visibilitySchema,evaluationVisibility:visibilitySchema,
 ratingSteps:z.number().int().min(1).max(10).nullable(),canonicalTier:tierSchema.nullable(),
 episode:z.number().int().min(0).max(1000000).nullable(),startedOn:z.iso.date().nullable(),finishedOn:z.iso.date().nullable(),
 note:text(5000),tags:tagsSchema,preferredLink:uuidSchema.nullable()
}).superRefine((v,ctx)=>{
 if (v.status === "planned" && (v.ratingSteps !== null || v.canonicalTier !== null)) ctx.addIssue({code:"custom",path:["status"],message:"평가하려면 보는 중·완독·중도하차 중 하나를 선택해 주세요."});
 if (v.startedOn && v.finishedOn && v.finishedOn < v.startedOn) ctx.addIssue({code:"custom",path:["finishedOn"],message:"종료일은 시작일 이후여야 해요."});
});
export type RecordPayload = z.infer<typeof recordPayloadSchema>;
export const recordSchema = z.object({
 workId:uuidSchema,version:versionSchema,status:readingSchema,libraryVisibility:visibilitySchema,evaluationVisibility:visibilitySchema,
 ratingSteps:z.number().int().min(1).max(10).nullable(),canonicalTier:tierSchema.nullable(),episode:z.number().int().nullable(),
 startedOn:z.string().nullable(),finishedOn:z.string().nullable(),note:z.string(),tags:z.array(z.string()),preferredLink:uuidSchema.nullable(),
 createdAt:z.string(),updatedAt:z.string(),work:cardSchema.nullable()
});
export type ReadingRecord = z.infer<typeof recordSchema>;
export const libraryResponseSchema = z.object({items:z.array(recordSchema),total:z.number().int().nonnegative(),hasNext:z.boolean()});
export const publicLibrarySchema = z.object({items:z.array(z.object({work:cardSchema,status:readingSchema.nullable(),ratingSteps:z.number().nullable(),canonicalTier:tierSchema.nullable()})),total:z.number().int().nonnegative(),hasNext:z.boolean()});
const counts = z.record(z.string(),z.number().int().nonnegative());
export const statsSchema = z.object({readCount:z.number().int().nonnegative(),statuses:counts,ratings:counts,tiers:counts,
 genres:z.array(z.object({name:z.string(),weight:z.number(),share:z.number()}))});
export type ReadingStats = z.infer<typeof statsSchema>;
export const workStatsSchema = z.object({ratingCount:z.number().int().nonnegative(),average:z.number().nullable(),tierCount:z.number().int().nonnegative(),tiers:counts});
export const libraryFiltersSchema = z.strictObject({q:text(100),status:readingSchema.nullable(),sort:z.enum(["updated","added","title","rating"]),
 platform:z.string().regex(/^[a-z0-9_]{1,40}$/).nullable(),genre:z.string().regex(/^[a-z0-9-]{1,40}$/).nullable(),
 rating:z.number().int().min(1).max(10).nullable(),tier:tierSchema.nullable(),tag:text(20).nullable()});
export type LibraryFilters = z.infer<typeof libraryFiltersSchema>;
export function parseLibraryFilters(params:SearchParams) {
 const single = (name:string) => z.string().optional().parse(params[name]) ?? "";
 const rating = single("rating");
 return libraryFiltersSchema.parse({q:single("q").trim(),status:single("status") || null,sort:single("sort") || "updated",platform:single("platform") || null,
  genre:single("genre") || null,rating:rating ? /^[1-9]$|^10$/.test(rating) ? Number(rating) : NaN : null,tier:single("tier") || null,tag:single("tag").trim() || null});
}
export function parsePage(value:unknown) { return value === undefined ? 1 : z.string().regex(/^[1-9][0-9]{0,3}$/).transform(Number).pipe(z.number().max(1000)).parse(value); }
export function libraryUrl(filters:LibraryFilters,page=1) {
 const query = new URLSearchParams();
 for (const [key,value] of Object.entries(filters)) if (value !== null && value !== "") query.set(key,String(value));
 if (page > 1) query.set("page",String(page));
 return "/me/library?"+query;
}
export const selectionSchema = z.array(z.strictObject({id:uuidSchema,version:versionSchema})).min(1).max(100)
 .refine(v=>new Set(v.map(i=>i.id)).size === v.length,"같은 작품을 중복 선택했어요.");
export const readingLabels = {reading:"보는 중",completed:"완독",dropped:"중도하차",planned:"나중에 볼 작품"} as const;
