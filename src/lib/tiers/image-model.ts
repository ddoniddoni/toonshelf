import { z } from "zod";
import { uuidSchema } from "@/lib/catalogue/model";
import { rowSchema, versionSchema } from "./model";
import { shareTokenSchema } from "./publication-model";

export const imageRequestSchema = z.strictObject({
  source: z.enum(["draft", "publication"]), version: versionSchema,
  token: shareTokenSchema.nullable(), confirm: z.literal(true), confirmSpoiler: z.boolean(),
}).refine(v => v.source !== "draft" || v.token === null, "초안에는 공유 링크를 사용하지 않아요.");
export type TierImageRequest = z.infer<typeof imageRequestSchema>;
// The image renderer receives text only, never cover IDs/URLs, private notes or tokens.
export const imageItemSchema = z.strictObject({title:z.string().max(600)}).nullable();
export const imageBodySchema = z.strictObject({
  title:z.string().max(160), description:z.string().max(2000), tags:z.array(z.string().max(40)).max(5),
  rows:z.array(rowSchema.extend({items:z.array(imageItemSchema).max(300)})).min(2).max(10),
});
export const imageSourceSchema = z.strictObject({
  id:uuidSchema, version:versionSchema, source:z.enum(["draft","publication"]), isSpoiler:z.boolean(),
  body:imageBodySchema, unplaced:z.array(imageItemSchema).max(300),
}).superRefine((v,ctx) => {
  if (v.body.rows.reduce((n,r) => n+r.items.length, v.unplaced.length) > 300)
    ctx.addIssue({code:"custom",message:"이미지는 최대 300작품까지 저장해요."});
  if (v.source === "publication" && v.unplaced.length)
    ctx.addIssue({code:"custom",message:"게시본에 미배치 작품을 포함할 수 없어요."});
});
export type TierImageSource = z.infer<typeof imageSourceSchema>;
export type ImageItem = z.infer<typeof imageItemSchema>;
export const IMAGE_COLUMNS = 7;
export const IMAGE_LINES = 7;
export type ImageLine = {label:string;colorToken:z.infer<typeof rowSchema>["colorToken"];continued:boolean;items:ImageItem[]};
export function paginateTierImage(source:TierImageSource):ImageLine[][] {
  const rows = source.body.rows.map(r => ({label:r.label,colorToken:r.colorToken,items:r.items}));
  if (source.source === "draft" && source.unplaced.length) rows.push({label:"미배치",colorToken:"F",items:source.unplaced});
  const lines:ImageLine[] = [];
  for (const row of rows) {
    if (!row.items.length) lines.push({...row,continued:false});
    for (let i=0;i<row.items.length;i+=IMAGE_COLUMNS)
      lines.push({...row,continued:i>0,items:row.items.slice(i,i+IMAGE_COLUMNS)});
  }
  const pages:ImageLine[][] = [];
  for (let i=0;i<lines.length;i+=IMAGE_LINES) pages.push(lines.slice(i,i+IMAGE_LINES));
  return pages;
}

// Plain text is escaped before entering Pango markup. Bound Unicode content and
// remove control/bidi characters so it cannot alter layout or markup execution.
export function imageText(value:string,max:number) {
  const clean=value.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g," ");
  const chars=Array.from(clean);return chars.length > max ? chars.slice(0,max-1).join("")+"…" : clean;
}
export function escapeImageText(value:string) {
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
