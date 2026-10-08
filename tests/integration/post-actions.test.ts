// @vitest-environment node
// Written only. Mocks do not prove real DB/Auth permissions.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),moderator:vi.fn(),rpc:vi.fn(),redirect:vi.fn(),client:vi.fn(),search:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/reviews/moderation",()=>({requireModerator:mocks.moderator}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/catalogue/data",()=>({searchWorks:mocks.search}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import { createPost,savePostDraft,publishPost,withdrawPost,revealPost,moderatePost,searchPostWorks } from "@/lib/posts/actions";
import { AuthFailure } from "@/lib/auth/errors";
const id="35000000-0000-4000-8000-000000000001";
const form=(values:Record<string,string>)=>{const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return f;};
describe("post server actions (written only)",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.rpc.mockResolvedValue({data:id,error:null});const a={client:{rpc:mocks.rpc}};mocks.account.mockResolvedValue(a);mocks.moderator.mockResolvedValue(a);mocks.client.mockResolvedValue(a.client);mocks.redirect.mockImplementation(()=>{throw new Error("NEXT_REDIRECT");});});
 it("requires current membership before writes or work search",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","정지 계정"));expect(await createPost(null,form({id}))).toMatchObject({ok:false});expect(await searchPostWorks("작품")).toMatchObject({ok:false});expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.search).not.toHaveBeenCalled();
 });
 it("saves only allowed draft fields with the expected version",async()=>{
  await expect(savePostDraft(null,form({id,draftVersion:"3",title:"초안 제목",body:"개인 초안",category:"request",isSpoiler:"on",userId:"forged",publicationStatus:"published"}))).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.rpc).toHaveBeenCalledWith("toon_save_post_draft",{p_id:id,p_version:3,p_payload:{title:"초안 제목",body:"개인 초안",category:"request",isSpoiler:true,workIds:[]}});
 });
 it("publishes stored versions and ignores forged replacement body",async()=>{
  await expect(publishPost(null,form({id,postVersion:"2",draftVersion:"5",confirm:"on",body:"not saved"}))).rejects.toThrow("NEXT_REDIRECT");expect(mocks.rpc).toHaveBeenCalledWith("toon_publish_post",{p_id:id,p_draft_version:5,p_post_version:2});
 });
 it("requires explicit confirmation for publish, withdraw and spoiler reveal",async()=>{
  expect(await publishPost(null,form({id,postVersion:"1",draftVersion:"1"}))).toMatchObject({ok:false});expect(await withdrawPost(null,form({id,postVersion:"1",operation:"delete"}))).toMatchObject({ok:false});expect(await revealPost(null,form({id,version:"1"}))).toMatchObject({ok:false});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("rechecks current access and version when revealing and hides internal errors",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await revealPost(null,form({id,version:"3",confirm:"on"}))).toMatchObject({ok:false});expect(mocks.rpc).toHaveBeenCalledWith("toon_get_post",{p_id:id,p_reveal:true,p_expected_version:3});
  mocks.rpc.mockResolvedValue({data:null,error:{code:"XX000",message:"private database detail"}});expect(JSON.stringify(await revealPost(null,form({id,version:"3",confirm:"on"})))).not.toContain("private database detail");
 });
 it("requires a server-verified moderator role",async()=>{
  mocks.moderator.mockRejectedValue(new AuthFailure("FORBIDDEN","운영자 아님"));expect(await moderatePost(null,form({postId:id,role:"admin"}))).toMatchObject({ok:false});expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
