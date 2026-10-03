// Contract tests written only; no live persistence/security evidence.
import { describe,expect,it } from "vitest";
import { mergePolicySchema,mergePreviewSchema } from "@/lib/catalogue/merge-model";
const work = {id:"10000000-0000-4000-8000-000000000001",title:"[테스트] 작품",version:1,status:"published"};
const preview = {source:work,target:{...work,id:"10000000-0000-4000-8000-000000000002"},previewToken:"20000000-0000-4000-8000-000000000001",blockedByPersonalDomains:false,sourceLinkCount:1,sourceGenreCount:1,sourceCoverWillBeRevoked:false,
 records:{library:2,overlappingLibrary:1,evaluations:1,reviews:1,drafts:1},conflicts:{notes:0,tags:0,plannedEvaluations:0,dates:0,reviews:0,unavailable:0,metadata:0},canMerge:true};
describe("administrator merge projection",()=>{
 it("keeps only aggregate counts and metadata at the client boundary",()=>{
  const parsed = mergePreviewSchema.parse({...preview,privateNote:"private-secret",userId:"owner",records:{...preview.records,body:"draft-secret"}});
  expect(parsed.records.library).toBe(2);expect(JSON.stringify(parsed)).not.toMatch(/private-secret|draft-secret|owner/);
 });
 it("rejects an old preview missing a token or domain counts",()=>{
  expect(mergePreviewSchema.safeParse({...preview,previewToken:undefined}).success).toBe(false);
  expect(mergePreviewSchema.safeParse({...preview,conflicts:undefined}).success).toBe(false);
  expect(mergePreviewSchema.safeParse({...preview,records:{...preview.records,drafts:-1}}).success).toBe(false);
 });
 it("cannot choose a policy that broadens visibility or deletes reviews",()=>{
  expect(mergePolicySchema.safeParse("latest_private").success).toBe(true);
  for (const policy of ["prefer_public","delete_old_review","source","target",""]) expect(mergePolicySchema.safeParse(policy).success).toBe(false);
 });
});
