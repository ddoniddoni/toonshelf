// @vitest-environment node
// Mock boundaries only. These are not live DB/RLS/Auth verification.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({admin:vi.fn(),account:vi.fn(),rpc:vi.fn(),redirect:vi.fn(),options:vi.fn()}));
vi.mock("@/lib/catalogue/admin",()=>({catalogueAdminAccount:mocks.admin}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("@/lib/catalogue/data",()=>({catalogueOptions:mocks.options}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import { mergeWorks,reviewSuggestion,submitSuggestion,upsertWork } from "@/lib/catalogue/actions";
import { AuthFailure } from "@/lib/auth/errors";
const form = (values:Record<string,string>)=>{const f = new FormData();for(const [key,value] of Object.entries(values))f.set(key,value);return f;};
describe("catalogue action authorization",()=>{
  beforeEach(()=>{
    vi.resetAllMocks();mocks.rpc.mockResolvedValue({error:null});
    mocks.admin.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.account.mockResolvedValue({client:{rpc:mocks.rpc},user:{id:"actual-owner"}});
    mocks.redirect.mockImplementation(()=>{throw new Error("NEXT_REDIRECT");});
  });
  it("does not allow a client role field to enter the administrator write path",async()=>{
    mocks.admin.mockRejectedValue(new AuthFailure("FORBIDDEN","관리자 아님"));
    const result = await upsertWork(null,form({isAdmin:"true",role:"admin"}));
    expect(result).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires explicit merge confirmation even when IDs and versions are valid",async()=>{
    const result = await mergeWorks(null,form({sourceId:"10000000-0000-4000-8000-000000000001",targetId:"10000000-0000-4000-8000-000000000002",sourceVersion:"1",targetVersion:"1",reason:"동일 웹툰 확인"}));
    expect(result).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not forward forged ownership/status into suggestion creation",async()=>{
    await expect(submitSuggestion(null,form({kind:"new_work",proposal:"추가할 작품과 출처를 충분히 설명해요.",sourceUrl:"https://example.test/source",userId:"another-user",status:"accepted"}))).rejects.toThrow("NEXT_REDIRECT");
    const args = mocks.rpc.mock.calls[0][1];
    expect(args).not.toHaveProperty("userId");expect(args).not.toHaveProperty("status");
    expect(mocks.rpc).toHaveBeenCalledWith("submit_catalogue_suggestion",expect.objectContaining({p_kind:"new_work",p_work_id:null}));
  });
  it("requires real account access before any suggestion write",async()=>{
    mocks.account.mockRejectedValue(new AuthFailure("ONBOARDING_REQUIRED","필수 동의 필요"));
    const result = await submitSuggestion(null,form({kind:"new_work",proposal:"작품 추가 요청이에요.",sourceUrl:"https://example.test/source"}));
    expect(result).toMatchObject({ok:false,error:{code:"ONBOARDING_REQUIRED"}});expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not reveal database/rights evidence text on review failures",async()=>{
    mocks.rpc.mockResolvedValue({error:{code:"XX000",message:"private evidence: contract-secret"}});
    const result = await reviewSuggestion(null,form({id:"10000000-0000-4000-8000-000000000001",status:"rejected",note:"출처 확인 불가"}));
    expect(result).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});
    expect(JSON.stringify(result)).not.toContain("contract-secret");
  });
});
