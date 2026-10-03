// @vitest-environment node
// Written mock boundaries only; no live DB/Auth/permission verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { previewTierEvaluations,commitTierEvaluations } from "@/lib/tiers/evaluation-actions";
import { AuthFailure } from "@/lib/auth/errors";
const id="20000000-0000-4000-8000-000000000001",workId="30000000-0000-4000-8000-000000000001";
const input={id,mode:"apply",version:1,choices:[{workId,status:"reading"}]},commit={...input,confirm:true,fingerprint:"a".repeat(64)};
describe("owner canonical action boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});});
 it("rejects inactive accounts and missing consent before any mutation",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","정지 계정"));expect(await previewTierEvaluations(input)).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
  mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});expect(await commitTierEvaluations({...commit,confirm:false})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.revalidate).not.toHaveBeenCalled();
 });
 it("sends IDs/status choices, never client-supplied ratings or ownership",async()=>{
  expect(await commitTierEvaluations({...commit,owner:id})).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  mocks.rpc.mockResolvedValue({data:{version:1,changed:1},error:null});expect(await commitTierEvaluations(commit)).toEqual({ok:true,version:1,changed:1});
  expect(mocks.rpc).toHaveBeenCalledWith("commit_tier_evaluations",{p_id:id,p_mode:"apply",p_version:1,p_choices:input.choices,p_fingerprint:commit.fingerprint,p_confirm:true});
  expect(mocks.revalidate).toHaveBeenCalledWith("/me/library","layout");expect(mocks.revalidate).toHaveBeenCalledWith("/works/[slug]","page");
  expect(mocks.revalidate).not.toHaveBeenCalledWith(`/tiers/${id}/publish`);
 });
 it("invalidates the draft after import without invalidating or changing personal evaluations",async()=>{
  mocks.rpc.mockResolvedValue({data:{version:2,changed:1},error:null});expect(await commitTierEvaluations({...commit,mode:"import",choices:[{workId,status:null}]})).toMatchObject({ok:true,version:2});
  expect(mocks.revalidate).toHaveBeenCalledWith(`/tiers/${id}/edit`);expect(mocks.revalidate).not.toHaveBeenCalledWith("/me/library","layout");
 });
 it("reports stale previews/status requirements safely and does not invalidate failed operations",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{message:"CONFLICT",details:"private record"}});expect(await commitTierEvaluations(commit)).toMatchObject({ok:false,error:{code:"CONFLICT"}});
  mocks.rpc.mockResolvedValue({data:null,error:{message:"READING_STATUS_REQUIRED"}});expect(await previewTierEvaluations(input)).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  mocks.rpc.mockResolvedValue({data:null,error:{message:"private SQL",details:"secret"}});const reply=await commitTierEvaluations(commit);
  expect(reply).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});expect(JSON.stringify(reply)).not.toMatch(/private SQL|secret/);expect(mocks.revalidate).not.toHaveBeenCalled();
 });
});
