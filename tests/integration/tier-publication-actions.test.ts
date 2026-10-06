// @vitest-environment node
// Action mocks only; not evidence of live DB/Auth/RLS behavior.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),moderator:vi.fn(),rpc:vi.fn(),revalidate:vi.fn(),issue:vi.fn(),recover:vi.fn(),hash:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/reviews/moderation",()=>({requireModerator:mocks.moderator}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({rpc:mocks.rpc})}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:()=>({siteUrl:"https://example.test"})}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/lib/tiers/share-token",()=>({issueShareToken:mocks.issue,recoverShareToken:mocks.recover,hashShareToken:mocks.hash}));
import { publishTier,rotateTierLink,withdrawTier,getTierShareUrl,revealTier } from "@/lib/tiers/publication-actions";
import { AuthFailure } from "@/lib/auth/errors";
import { ConfigurationError } from "@/lib/env/schema";
const id="20000000-0000-4000-8000-000000000001",hash="a".repeat(64),token="A".repeat(43);
const state={id,version:2,visibility:"unlisted",publishedVersion:1,moderationStatus:"visible",publishedAt:"2026-10-04T00:00:00Z",hasShareToken:true};
const input={id,draftVersion:1,listVersion:1,fingerprint:hash,visibility:"unlisted",isSpoiler:true,confirm:true};
describe("publication and share action boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.issue.mockReturnValue({hash,ciphertext:"b".repeat(118),nonce:"c".repeat(24)});mocks.rpc.mockResolvedValue({data:state,error:null});mocks.hash.mockReturnValue(hash);});
 it("requires an active owner and rejects injected ownership/payload fields",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","정지 계정"));expect(await publishTier(input)).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
  mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});
  expect(await publishTier({...input,userId:"victim"})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  expect(await publishTier({...input,payload:{title:"unreviewed"}})).toMatchObject({ok:false});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("passes saved versions/fingerprint and encrypted envelope, without raw tokens or actor IDs",async()=>{
  expect(await publishTier(input)).toMatchObject({ok:true,state});expect(mocks.rpc).toHaveBeenCalledWith("toon_publish_tier_list",{
   p_id:id,p_draft_version:1,p_list_version:1,p_fingerprint:hash,p_visibility:"unlisted",p_spoiler:true,p_token:mocks.issue.mock.results[0]!.value,p_confirm:true
  });expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(token);expect(mocks.revalidate).toHaveBeenCalledWith("/share/t/[token]","page");
 });
 it("keeps public publication and withdrawal available without a share encryption key",async()=>{
  mocks.issue.mockImplementation(()=>{throw new ConfigurationError(["SHARE_TOKEN_ENCRYPTION_KEY"]);});
  expect(await publishTier({...input,visibility:"public"})).toMatchObject({ok:true});expect(mocks.issue).not.toHaveBeenCalled();
  expect(await withdrawTier({id,version:2,confirm:true})).toMatchObject({ok:true});expect(mocks.issue).not.toHaveBeenCalled();
 });
 it("fails unlisted publication/rotation before RPC when encryption is unavailable",async()=>{
  mocks.issue.mockImplementation(()=>{throw new ConfigurationError(["SHARE_TOKEN_ENCRYPTION_KEY"]);});
  expect(await publishTier(input)).toMatchObject({ok:false,error:{code:"CONFIG_REQUIRED"}});
  expect(await rotateTierLink({id,version:2,confirm:true})).toMatchObject({ok:false,error:{code:"CONFIG_REQUIRED"}});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("does not disclose database details or invalidate after conflicts",async()=>{
  mocks.rpc.mockResolvedValue({error:{message:"CONFLICT",detail:"private secret"},data:null});const reply=await publishTier(input);
  expect(reply).toMatchObject({ok:false,error:{code:"CONFLICT"}});expect(JSON.stringify(reply)).not.toContain("private secret");expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("recovers a URL only through the current owner's expected-version RPC",async()=>{
  const envelope={hash,ciphertext:"b".repeat(118),nonce:"c".repeat(24)};mocks.rpc.mockResolvedValue({data:envelope,error:null});mocks.recover.mockReturnValue(token);
  expect(await getTierShareUrl({id,version:2})).toEqual({ok:true,url:`https://example.test/share/t/${token}`});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_my_tier_share_token",{p_id:id,p_version:2});expect(mocks.recover).toHaveBeenCalledWith(id,envelope);
 });
 it("requires explicit reveal confirmation and sends only a hash to the current-reader RPC",async()=>{
  expect(await revealTier({id,version:2,token,confirm:false})).toMatchObject({ok:false});expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({data:null,error:null});expect(await revealTier({id,version:2,token,confirm:true})).toMatchObject({ok:false,error:{code:"NOT_FOUND"}});
  expect(mocks.rpc).toHaveBeenCalledWith("toon_get_tier_publication",{p_id:id,p_hash:hash,p_reveal:true,p_version:2});expect(mocks.account).not.toHaveBeenCalled();
 });
});
