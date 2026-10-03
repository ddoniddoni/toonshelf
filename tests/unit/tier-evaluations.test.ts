import { describe,expect,it } from "vitest";
import { evaluationCommitSchema,evaluationContextSchema,evaluationInputSchema,evaluationPreviewSchema } from "@/lib/tiers/evaluation-model";
const id="20000000-0000-4000-8000-000000000001",workId="30000000-0000-4000-8000-000000000001";
const input={id,mode:"apply",version:1,choices:[{workId,status:null}]};
describe("explicit canonical evaluation contracts",()=>{
 it("requires confirmation and a snapshot, without allowing injected ownership or tiers",()=>{
  const valid={...input,fingerprint:"a".repeat(64),confirm:true};expect(evaluationCommitSchema.safeParse(valid).success).toBe(true);
  for (const invalid of [{...valid,confirm:false},{...valid,fingerprint:"short"},{...valid,userId:id},{...valid,choices:[{workId,status:null,tier:"S"}]}])
   expect(evaluationCommitSchema.safeParse(invalid).success).toBe(false);
 });
 it("accepts only explicit non-planned status choices and forbids status edits during import",()=>{
  expect(evaluationInputSchema.safeParse({...input,choices:[{workId,status:"completed"}]}).success).toBe(true);
  for (const invalid of [{...input,choices:[{workId,status:"planned"}]},{...input,mode:"import",choices:[{workId,status:"reading"}]}])
   expect(evaluationInputSchema.safeParse(invalid).success).toBe(false);
 });
 it("rejects empty, duplicate and over-limit selections including alternate UUID spelling",()=>{
  const upper={workId:"AAAAAAAA-0000-4000-8000-000000000001",status:null};
  for (const choices of [[],[...input.choices,...input.choices],[upper,{...upper,workId:upper.workId.toLowerCase()}],Array.from({length:101},(_,n)=>({workId:`30000000-0000-4000-8000-${String(n+1).padStart(12,"0")}`,status:null}))])
   expect(evaluationInputSchema.safeParse({...input,choices}).success).toBe(false);
 });
 it("does not infer canonical codes from custom row labels, and strips private details from DTOs",()=>{
  const item={workId,title:"작품",workVersion:1,status:"completed",entryVersion:1,ratingSteps:7,sourceTier:null,targetTier:null,
   libraryVisibility:"private",evaluationVisibility:null,fromRow:"S급",toRow:"S급",targetRowId:id,requiresStatus:false,reason:"custom",privateNote:"never serialize"};
  const context=evaluationContextSchema.parse({id,title:"초안",version:1,mode:"apply",page:1,hasMore:false,items:[item]});
  expect(context.items[0].targetTier).toBeNull();expect(context.items[0].reason).toBe("custom");expect(JSON.stringify(context)).not.toContain("never serialize");
  const preview=evaluationPreviewSchema.parse({id,version:1,mode:"apply",fingerprint:"a".repeat(64),items:[{...item,nextStatus:"completed"}]});
  expect(preview.items[0].ratingSteps).toBe(7);expect(preview.items[0]).not.toHaveProperty("privateNote");
 });
});
