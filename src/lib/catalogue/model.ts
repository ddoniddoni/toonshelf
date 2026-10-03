import { z } from "zod";

const text = (min:number,max:number) => z.string().refine(v=>Array.from(v).length >= min && Array.from(v).length <= max,min+"~"+max+"자로 입력해 주세요.");
export const serialSchema = z.enum(["ongoing","completed","hiatus","unknown"]);
export const ageSchema = z.enum(["all","12","15","19","unknown"]);
export const publicAgeSchema = ageSchema.exclude(["19","unknown"]);
export const workStatusSchema = z.enum(["draft","published","hidden"]);
export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/,"영문 소문자·숫자·하이픈으로 3~80자 입력해 주세요.");
export const uuidSchema = z.uuid();
const aliases = (max:number) => z.array(text(1,max)).max(20).refine(a=>new Set(a).size === a.length,"별칭이 중복됐어요.");
export const platformSchema = z.object({id:uuidSchema,code:z.string(),name:z.string(),approved_hosts:z.array(z.string()),active:z.boolean()});
export type Platform = z.infer<typeof platformSchema>;
export const genreSchema = z.object({id:uuidSchema,slug:z.string(),name:z.string()});
export const creatorInputSchema = z.strictObject({id:uuidSchema.nullable(),name:text(1,100),aliases:aliases(100),role:z.enum(["writer","artist","original","studio"]),order:z.number().int().min(0).max(99)});
export const sourceUrlSchema = z.string().max(2048).refine(value=>{
  try { const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(url.hostname) && !/\.(local|internal)$/.test(url.hostname) &&
      !/[\s\u0000-\u001f\u007f]/.test(value) && url.href === value;
  } catch { return false; }
},"공개 가능한 HTTPS 출처 주소를 입력해 주세요.");
export const TRACKING_KEYS = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"] as const;
export function canonicalOfficialUrl(value:string,platform:Pick<Platform,"approved_hosts">) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.port || !platform.approved_hosts.includes(url.hostname) || /[\s\u0000-\u001f\u007f]/.test(value)) throw new Error("INVALID_OFFICIAL_URL");
  url.hash = "";
  for (const key of TRACKING_KEYS) url.searchParams.delete(key);
  if ([...url.searchParams.keys()].some(key=>!/^[A-Za-z0-9_.-]+$/.test(key))) throw new Error("INVALID_OFFICIAL_URL");
  return url.href;
}
export const linkInputSchema = z.strictObject({
  platformId:uuidSchema,url:z.string().max(2048),externalId:text(1,100).nullable(),
  weekdays:z.array(z.number().int().min(0).max(6)).max(7).refine(a=>new Set(a).size === a.length),
  serialStatus:serialSchema,ageRating:ageSchema,verifiedAt:z.iso.datetime({offset:true}),active:z.boolean()
});
export const workPayloadSchema = z.strictObject({
  slug:slugSchema,title:text(1,200),aliases:aliases(200),description:text(0,2000),
  serialStatus:serialSchema,ageRating:ageSchema,catalogueStatus:workStatusSchema,
  creators:z.array(creatorInputSchema).max(20),genreIds:z.array(uuidSchema).max(12).refine(a=>new Set(a).size === a.length),
  links:z.array(linkInputSchema).min(1).max(20),
  source:z.strictObject({url:sourceUrlSchema,fields:z.array(z.enum(["title","aliases","creators","genres","serialStatus","ageRating","links","description"])).min(3).max(8),
    verifiedAt:z.iso.datetime({offset:true}),note:text(0,2000)})
}).superRefine((v,ctx)=>{
  if (v.catalogueStatus === "published" && !["all","12","15"].includes(v.ageRating)) ctx.addIssue({code:"custom",path:["ageRating"],message:"확인된 비성인 등급만 공개할 수 있어요."});
  if (!["title","ageRating","links"].every(f=>v.source.fields.includes(f as typeof v.source.fields[number]))) ctx.addIssue({code:"custom",path:["source"],message:"제목·연령 등급·공식 링크의 출처를 확인해 주세요."});
  if (new Set(v.links.map(l=>l.url)).size !== v.links.length) ctx.addIssue({code:"custom",path:["links"],message:"공식 링크가 중복됐어요."});
  const externalIds = v.links.filter(l=>l.externalId !== null).map(l=>l.platformId+":"+l.externalId);
  if (new Set(externalIds).size !== externalIds.length) ctx.addIssue({code:"custom",path:["links"],message:"같은 플랫폼의 작품 식별자가 중복됐어요."});
  if (Date.parse(v.source.verifiedAt) > Date.now() || v.links.some(l=>Date.parse(l.verifiedAt) > Date.now())) ctx.addIssue({code:"custom",path:["source"],message:"확인일은 미래일 수 없어요."});
});
export type WorkPayload = z.infer<typeof workPayloadSchema>;
export const cardSchema = z.object({
  id:uuidSchema,slug:slugSchema,title:z.string(),aliases:z.array(z.string()),serialStatus:serialSchema,ageRating:publicAgeSchema,createdAt:z.string(),
  coverAssetId:uuidSchema.nullable(),coverAttribution:z.string(),
  creators:z.array(z.object({id:uuidSchema,name:z.string(),role:creatorInputSchema.shape.role})),
  genres:z.array(genreSchema),platforms:z.array(z.object({id:uuidSchema,code:z.string(),name:z.string()}))
});
export type WorkCard = z.infer<typeof cardSchema>;
export const detailSchema = cardSchema.extend({description:z.string(),links:z.array(z.object({
  id:uuidSchema,platformId:uuidSchema,platformName:z.string(),platformCode:z.string(),url:z.string(),
  weekdays:z.array(z.number()),serialStatus:serialSchema,ageRating:publicAgeSchema,verifiedAt:z.string()
}))});
export type WorkDetail = z.infer<typeof detailSchema>;
export const catalogueRatingSchema = z.strictObject({average:z.number().min(0.5).max(5).nullable(),ratingCount:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)})
 .refine(v=>(v.ratingCount === 0) === (v.average === null),"평가 수와 평균이 일치하지 않아요.");
export type CatalogueRating = z.infer<typeof catalogueRatingSchema>;
export const catalogueCardSchema = cardSchema.extend({rating:catalogueRatingSchema});
export const cursorPositionSchema = z.strictObject({id:uuidSchema,createdAt:z.iso.datetime({offset:true}),title:text(0,200)});
export const ratingCursorPositionSchema = z.strictObject({id:uuidSchema,ratingSum:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),ratingCount:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),viewerId:uuidSchema.nullable()})
 .refine(v=>v.ratingCount === 0 ? v.ratingSum === 0 : v.ratingSum >= v.ratingCount && v.ratingSum <= v.ratingCount * 10,"평점 페이지 주소가 올바르지 않아요.");
export const catalogueCursorPositionSchema = z.union([cursorPositionSchema,ratingCursorPositionSchema]);
export type CatalogueCursorPosition = z.infer<typeof catalogueCursorPositionSchema>;
export const searchResponseSchema = z.object({items:z.array(catalogueCardSchema),total:z.number().int().nonnegative(),next:catalogueCursorPositionSchema.nullable()});
export const filtersSchema = z.strictObject({
  q:text(0,100),platform:z.array(z.string().regex(/^[a-z0-9_]{1,40}$/)).max(8),
  genre:z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).max(12),status:serialSchema.nullable(),
  day:z.array(z.number().int().min(0).max(6)).max(7),age:publicAgeSchema.nullable(),sort:z.enum(["latest","title","rating"])
});
export type CatalogueFilters = z.infer<typeof filtersSchema>;
export type SearchParams = Record<string,string|string[]|undefined>;
const single = (params:SearchParams,key:string) => z.string().optional().parse(params[key]);
export function parseFilters(params:SearchParams):CatalogueFilters {
  const multiple = (key:string) => { const v = params[key]; return Array.from(new Set(v === undefined ? [] : Array.isArray(v) ? v : [v])).sort(); };
  return filtersSchema.parse({q:(single(params,"q") ?? "").trim(),platform:multiple("platform"),genre:multiple("genre"),
    status:single(params,"status") || null,day:multiple("day").map(d=>/^[0-6]$/.test(d)?Number(d):NaN),age:single(params,"age") || null,sort:single(params,"sort") ?? "latest"});
}
export function filterUrl(filters:CatalogueFilters,cursor?:string) {
  const query = new URLSearchParams();
  if (filters.q) query.set("q",filters.q);
  for (const v of filters.platform) query.append("platform",v);
  for (const v of filters.genre) query.append("genre",v);
  if (filters.status) query.set("status",filters.status);
  for (const v of filters.day) query.append("day",String(v));
  if (filters.age) query.set("age",filters.age);
  query.set("sort",filters.sort);
  if (cursor) query.set("cursor",cursor);
  return "/explore?"+query;
}
export const suggestionSchema = z.strictObject({kind:z.enum(["new_work","correction","broken_link"]),workId:uuidSchema.nullable(),proposal:text(10,5000),sourceUrl:sourceUrlSchema})
 .refine(v=>(v.kind === "new_work") === (v.workId === null),"작품 추가 또는 기존 작품 수정을 선택해 주세요.");
export const reasonSchema = text(2,1000);
export const licenseSchema = z.strictObject({
  rightsHolder:text(1,200),evidence:text(1,2000),display:z.boolean(),og:z.boolean(),export:z.boolean(),commercial:z.boolean(),
  attribution:text(0,500),validFrom:z.iso.datetime({offset:true}),expiresAt:z.iso.datetime({offset:true}).nullable()
}).refine(v=>v.expiresAt === null || Date.parse(v.expiresAt) > Date.parse(v.validFrom),"허가 만료일은 시작일 이후여야 해요.");
export const roleLabels = {writer:"글",artist:"그림",original:"원작",studio:"스튜디오"} as const;
export const serialLabels = {ongoing:"연재 중",completed:"연재 완료",hiatus:"휴재",unknown:"미확인"} as const;
export const ageLabels = {all:"전체 이용가","12":"12세 이상","15":"15세 이상","19":"성인 · 공개 불가",unknown:"미확인 · 공개 불가"} as const;
export const dayLabels = ["일","월","화","수","목","금","토"] as const;
