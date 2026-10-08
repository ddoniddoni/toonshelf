// @vitest-environment node
// Written mocked boundaries only; no live Auth/RLS, migrations, or concurrency run.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),moderator:vi.fn(),rpc:vi.fn(),env:vi.fn(),revalidate:vi.fn(),redirect:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/reviews/moderation",()=>({requireModerator:mocks.moderator}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:mocks.env}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import { createReviewComment,getMyReviewComment,updateReviewComment,deleteReviewComment,revealReviewComment,reportReviewComment,revealModerationComment,moderateReviewComment } from "@/lib/review-comments/actions";
import { listReviewComments,getReviewComment,listCommentReports,getCommentModeration } from "@/lib/review-comments/data";
import { AuthFailure } from "@/lib/auth/errors";
const id="20000000-0000-4000-8000-000000000001",reviewId="20000000-0000-4000-8000-000000000002",access={id,reviewVersion:2,version:1};
const create={id,reviewId,reviewVersion:2,parentId:null,body:" 댓글 ",isSpoiler:true,confirm:true};
const comment={id,reviewId,parentId:null,version:1,createdAt:"2026-10-05T00:00:00Z",updatedAt:"2026-10-05T00:00:00Z",deleted:false,
 isSpoiler:true,body:null,author:{id:reviewId,username:"author",name:"작성자"},canEdit:false,canReport:false,canReply:false,replyCount:0};
describe("review comment server boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();const account={client:{rpc:mocks.rpc}};mocks.account.mockResolvedValue(account);mocks.moderator.mockResolvedValue(account);mocks.env.mockReturnValue({supabase:{}});mocks.rpc.mockResolvedValue({data:null,error:null});});
 it("rejects a different review or publication version in the returned page",async()=>{
  const input={reviewId,reviewVersion:2,parentId:null,page:1};
  mocks.rpc.mockResolvedValue({data:{reviewId,reviewVersion:3,parentId:null,items:[],hasNext:false},error:null});
  await expect(listReviewComments(input)).rejects.toThrow();
  mocks.rpc.mockResolvedValue({data:{reviewId:id,reviewVersion:2,parentId:null,items:[],hasNext:false},error:null});
  await expect(listReviewComments(input)).rejects.toThrow();
 });
 it("requires an account, rejects forged fields, and does not invalidate failed writes",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("AUTH_REQUIRED","로그인"));expect(await createReviewComment(create)).toMatchObject({ok:false,error:{code:"AUTH_REQUIRED"}});
  mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});
  for (const v of [{...create,userId:id},{...create,token:"secret"},{...create,confirm:false}]) expect(await createReviewComment(v)).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("passes the stable request ID and separate lifecycle/revision values after trimming",async()=>{
  mocks.rpc.mockResolvedValue({data:id,error:null});expect(await createReviewComment(create)).toEqual({ok:true,id});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_create_review_comment",{p_id:id,p_review:reviewId,p_review_version:2,p_parent:null,p_body:"댓글",p_spoiler:true,p_confirm:true});
  expect(mocks.revalidate).toHaveBeenCalledWith("/reviews","layout");
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await updateReviewComment({...access,body:"수정",isSpoiler:false,confirm:true})).toEqual({ok:true});
  expect(mocks.rpc).toHaveBeenLastCalledWith("toon_update_review_comment",{p_id:id,p_review_version:2,p_version:1,p_body:"수정",p_spoiler:false,p_confirm:true});
  expect(await deleteReviewComment({id,version:1,confirm:true})).toEqual({ok:true});expect(mocks.rpc).toHaveBeenLastCalledWith("toon_delete_review_comment",{p_id:id,p_version:1,p_confirm:true});
 });
 it("maps conflicts, denied permissions, and unknown DB failures without disclosing details",async()=>{
  for (const [message,code] of [["CONFLICT","CONFLICT"],["NOT_FOUND","NOT_FOUND"],["FORBIDDEN","FORBIDDEN"],["RATE_LIMITED","RATE_LIMITED"],["private sql secret","INTERNAL_ERROR"]]) {
   mocks.rpc.mockResolvedValue({data:null,error:{message,details:"private-body"}});const reply=await updateReviewComment({...access,body:"수정",isSpoiler:true,confirm:true});
   expect(reply).toMatchObject({ok:false,error:{code}});expect(JSON.stringify(reply)).not.toMatch(/private sql|private-body/);
  }
  expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("requests owner text explicitly and permits anonymous reveal only with confirmation/version",async()=>{
  mocks.rpc.mockResolvedValue({data:{id,version:1,body:"내 댓글",isSpoiler:true,privateNote:"secret"},error:null});
  expect(await getMyReviewComment(access)).toEqual({ok:true,editor:{id,version:1,body:"내 댓글",isSpoiler:true}});
  mocks.rpc.mockClear();mocks.account.mockClear();expect(await revealReviewComment({...access,confirm:false})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({data:{...comment,body:"펼친 본문",privateNote:"secret"},error:null});expect(await revealReviewComment({...access,confirm:true})).toEqual({ok:true,body:"펼친 본문"});
  expect(mocks.account).not.toHaveBeenCalled();expect(mocks.rpc).toHaveBeenCalledWith("toon_get_review_comment",{p_id:id,p_review_version:2,p_version:1,p_reveal:true});
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await revealReviewComment({...access,confirm:true})).toMatchObject({ok:false,error:{code:"NOT_FOUND"}});
 });
 it("keeps public DAL masked, bounded, session-aware, and rejects unlisted tokens",async()=>{
  const input={reviewId,reviewVersion:2,parentId:null,page:1},page={reviewId,reviewVersion:2,parentId:null,items:[comment],hasNext:false};
  mocks.rpc.mockResolvedValue({data:page,error:null});expect(await listReviewComments(input)).toEqual(page);
  expect(mocks.rpc).toHaveBeenCalledWith("toon_list_review_comments",{p_review:reviewId,p_review_version:2,p_parent:null,p_page:1});expect(mocks.account).not.toHaveBeenCalled();
  await expect(listReviewComments({...input,token:"secret"})).rejects.toThrow();
  mocks.rpc.mockResolvedValue({data:{...comment,body:"spoiler-secret"},error:null});await expect(getReviewComment(id,2)).rejects.toThrow();
  mocks.env.mockReturnValue({supabase:null});mocks.rpc.mockClear();expect(await listReviewComments(input)).toBeNull();expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("sends reports only under the caller account and exposes own vs role queues separately",async()=>{
  expect(await reportReviewComment({...access,reason:"spam",detail:"반복해서 광고를 게시합니다."})).toEqual({ok:true});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_report_review_comment",{p_id:id,p_review_version:2,p_version:1,p_reason:"spam",p_detail:"반복해서 광고를 게시합니다."});
  mocks.rpc.mockResolvedValue({data:{items:[],hasNext:false},error:null});await listCommentReports(2,true);expect(mocks.rpc).toHaveBeenLastCalledWith("toon_list_review_comment_reports",{p_page:2,p_own:true});
  await listCommentReports(1);expect(mocks.moderator).toHaveBeenCalled();expect(mocks.rpc).toHaveBeenLastCalledWith("toon_list_review_comment_reports",{p_page:1,p_own:false});
 });
 it("denies nonmoderators before snapshot/body/actions and masks initial moderator text",async()=>{
  mocks.moderator.mockRejectedValue(new AuthFailure("FORBIDDEN","권한 없음"));await expect(getCommentModeration(id)).rejects.toThrow();
  expect(await revealModerationComment({id,version:1,confirm:true})).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
  expect(await moderateReviewComment(null,new FormData())).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.redirect).not.toHaveBeenCalled();
  mocks.moderator.mockResolvedValue({client:{rpc:mocks.rpc}});const snapshot={id,version:1,reviewId,deleted:false,moderationStatus:"visible",canModerate:true,body:null,reports:[],events:[]};
  mocks.rpc.mockResolvedValue({data:snapshot,error:null});expect(await getCommentModeration(id)).toEqual(snapshot);
  mocks.rpc.mockResolvedValue({data:{...snapshot,body:"secret"},error:null});await expect(getCommentModeration(id)).rejects.toThrow();
  expect(await revealModerationComment({id,version:1,confirm:true})).toEqual({ok:true,body:"secret"});
 });
});
