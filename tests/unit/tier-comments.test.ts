// Written contracts only; not executed and not proof of database permissions.
import { describe,expect,it } from "vitest";
import { commentBodySchema,commentCreateSchema,commentEditSchema,commentDeleteSchema,commentPageSchema,commentQuerySchema,
 maskedCommentSchema,maskedCommentModerationSchema,commentModerateInputSchema,commentPageUrl } from "@/lib/comments/model";
const id="20000000-0000-4000-8000-000000000001",tierId="20000000-0000-4000-8000-000000000002";
const comment={id,tierId,parentId:null,version:1,createdAt:"2026-10-05T00:00:00Z",updatedAt:"2026-10-05T00:00:00Z",deleted:false,
 isSpoiler:true,body:null,author:{id,username:"author",name:"작성자"},canEdit:false,canReport:false,canReply:false,replyCount:0};
describe("tier comment disclosure and input limits",()=>{
 it("counts Unicode code points after trimming and rejects empty/oversized text",()=>{
  expect(commentBodySchema.parse(" \n🙂\t ")).toBe("🙂");expect(commentBodySchema.parse("🙂".repeat(1000))).toHaveLength(2000);
  for (const body of [" \n\t","가".repeat(1001),"🙂".repeat(1001)]) expect(commentBodySchema.safeParse(body).success).toBe(false);
 });
 it("requires explicit confirmation, expected versions, and rejects actor/token injection",()=>{
  const create={id,tierId,tierVersion:2,parentId:null,body:"댓글",isSpoiler:true,confirm:true};
  expect(commentCreateSchema.parse(create)).toEqual(create);
  for (const value of [{...create,confirm:false},{...create,userId:id},{...create,token:"capability"},{...create,tierVersion:0},{...create,parentId:"bad"}]) expect(commentCreateSchema.safeParse(value).success).toBe(false);
  expect(commentEditSchema.safeParse({id,tierVersion:2,version:1,body:"수정",isSpoiler:false,confirm:true,parentId:id}).success).toBe(false);
  expect(commentDeleteSchema.safeParse({id,version:1,confirm:true}).success).toBe(true);
 });
 it("rejects initial spoiler text, missing nonspoiler text, and identifying tombstones",()=>{
  expect(maskedCommentSchema.safeParse(comment).success).toBe(true);
  expect(maskedCommentSchema.safeParse({...comment,body:"spoiler-secret"}).success).toBe(false);
  expect(maskedCommentSchema.safeParse({...comment,isSpoiler:false}).success).toBe(false);
  const deleted={...comment,deleted:true,author:null};expect(maskedCommentSchema.safeParse(deleted).success).toBe(true);
  for (const value of [{...deleted,body:"deleted-secret"},{...deleted,author:comment.author},{...deleted,canEdit:true}]) expect(maskedCommentSchema.safeParse(value).success).toBe(false);
 });
 it("does not accept cross-target pages, second-level reply affordances, or extra rows",()=>{
  const page={tierId,tierVersion:2,parentId:null,items:[comment],hasNext:false};expect(commentPageSchema.safeParse(page).success).toBe(true);
  expect(commentPageSchema.safeParse({...page,tierId:id}).success).toBe(false);
  expect(commentPageSchema.safeParse({...page,items:Array(21).fill(comment)}).success).toBe(false);
  expect(maskedCommentSchema.safeParse({...comment,parentId:tierId,canReply:true}).success).toBe(false);
  expect(maskedCommentSchema.safeParse({...comment,parentId:tierId,replyCount:1}).success).toBe(false);
 });
 it("validates pagination and preserves thread IDs across navigation",()=>{
  expect(commentQuerySchema.parse({})).toEqual({parentId:null,page:1});expect(commentQuerySchema.parse({parent:id,page:"1000"})).toEqual({parentId:id,page:1000});
  for (const value of [{page:"01"},{page:"1.0"},{page:"1001"},{page:["1","2"]},{parent:"bad"},{token:"secret"}]) expect(commentQuerySchema.safeParse(value).success).toBe(false);
  expect(commentPageUrl(tierId,id,2)).toBe(`/tiers/${tierId}/comments?parent=${id}&page=2#comments`);
  expect(commentPageUrl(tierId)).toBe(`/tiers/${tierId}/comments#comments`);
 });
 it("keeps moderation initial text masked and requires a selected report/result for rejection",()=>{
  const snapshot={id,version:1,tierId,deleted:false,moderationStatus:"visible",canModerate:true,body:null,reports:[],events:[]};
  expect(maskedCommentModerationSchema.safeParse(snapshot).success).toBe(true);expect(maskedCommentModerationSchema.safeParse({...snapshot,body:"secret"}).success).toBe(false);
  const action={id,version:1,action:"reject_report",reason:"사유",reportId:null,result:"안내"};
  expect(commentModerateInputSchema.safeParse(action).success).toBe(false);expect(commentModerateInputSchema.safeParse({...action,reportId:id}).success).toBe(true);
  expect(commentModerateInputSchema.safeParse({...action,reportId:id,result:""}).success).toBe(false);
  expect(commentModerateInputSchema.safeParse({...action,reportId:id,result:"🙂"}).success).toBe(false);
 });
});
