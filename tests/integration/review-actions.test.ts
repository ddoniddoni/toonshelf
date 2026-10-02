// @vitest-environment node
// Mock request boundaries; never treated as live RLS/Auth/Storage evidence.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({account:vi.fn(),moderator:vi.fn(),rpc:vi.fn(),redirect:vi.fn(),client:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/reviews/moderation",()=>({requireModerator:mocks.moderator}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import { createReview,saveReviewDraft,publishReview,revealReviewBody,moderateReview,setUserBlock,withdrawReview } from "@/lib/reviews/actions";
import { AuthFailure } from "@/lib/auth/errors";
const id = "10000000-0000-4000-8000-000000000001";
const form = (values:Record<string,string>)=>{const f = new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return f;};
describe("review action boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.rpc.mockResolvedValue({data:id,error:null});const account = {client:{rpc:mocks.rpc}};mocks.account.mockResolvedValue(account);mocks.moderator.mockResolvedValue(account);mocks.client.mockResolvedValue(account.client);mocks.redirect.mockImplementation(()=>{throw new Error("NEXT_REDIRECT");});});
 it("rejects suspended account writes before the RPC",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","정지 계정"));
  expect(await createReview(null,form({workId:id}))).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("stores only private draft fields and never caller-selected owner/status",async()=>{
  await expect(saveReviewDraft(null,form({id,draftVersion:"1",body:"비공개 수정 초안",isSpoiler:"on",episode:"7",userId:"victim",moderationStatus:"visible",publicationStatus:"published"}))).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.rpc).toHaveBeenCalledWith("save_review_draft",{p_id:id,p_version:1,p_payload:{body:"비공개 수정 초안",isSpoiler:true,episode:7}});
 });
 it("publishes the stored version without accepting a caller body",async()=>{
  await expect(publishReview(null,form({id,draftVersion:"2",reviewVersion:"1",confirm:"on",body:"forged-body"}))).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.rpc).toHaveBeenCalledWith("publish_review",{p_id:id,p_draft_version:2,p_review_version:1});
 });
 it("requires explicit publication/withdrawal/block/reveal confirmation",async()=>{
  expect(await publishReview(null,form({id,draftVersion:"2",reviewVersion:"1"}))).toMatchObject({ok:false});
  expect(await withdrawReview(null,form({id,reviewVersion:"1",operation:"delete"}))).toMatchObject({ok:false});
  expect(await setUserBlock(null,form({userId:id,blocked:"true"}))).toMatchObject({ok:false});
  expect(await revealReviewBody(null,form({id,version:"1"}))).toMatchObject({ok:false});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("rechecks public availability on an explicit spoiler reveal",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});const result = await revealReviewBody(null,form({id,version:"3",confirm:"on"}));
  expect(result).toMatchObject({ok:false});expect(mocks.rpc).toHaveBeenCalledWith("get_review",{p_id:id,p_reveal:true,p_expected_version:3});
 });
 it("does not allow forged metadata to acquire moderation rights",async()=>{
  mocks.moderator.mockRejectedValue(new AuthFailure("FORBIDDEN","운영자 아님"));
  expect(await moderateReview(null,form({reviewId:id,role:"admin"}))).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("does not return secret DB evidence or internal error details",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:"XX000",message:"private-draft-body-secret"}});
  expect(JSON.stringify(await revealReviewBody(null,form({id,version:"1",confirm:"on"})))).not.toContain("private-draft-body-secret");
 });
});
