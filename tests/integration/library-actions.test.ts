// @vitest-environment node
// Mock action boundaries only; not live persistence, RLS or session evidence.
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),redirect:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
import { saveReadingRecord,copyWorkToLibrary,bulkLibraryChange,makeAllLibraryPrivate } from "@/lib/library/actions";
import { AuthFailure } from "@/lib/auth/errors";
const id = "10000000-0000-4000-8000-000000000001";
const form = (values:Record<string,string>)=>{const f = new FormData();for(const [key,value] of Object.entries(values))f.set(key,value);return f;};
describe("library action boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.account.mockResolvedValue({client:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({error:null});mocks.redirect.mockImplementation(()=>{throw new Error("NEXT_REDIRECT");});});
 it("requires active account access before saving anything",async()=>{
  mocks.account.mockRejectedValue(new AuthFailure("FORBIDDEN","정지 계정"));
  expect(await copyWorkToLibrary(null,form({workId:id,userId:"victim"}))).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("never forwards another user's ownership or rating when copying",async()=>{
  await expect(copyWorkToLibrary(null,form({workId:id,userId:"victim",ratingSteps:"10"}))).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.rpc).toHaveBeenCalledWith("copy_work_to_library",{p_work:id});
 });
 it("rejects planned evaluations before a DB call",async()=>{
  const result = await saveReadingRecord(null,form({workId:id,status:"planned",libraryVisibility:"private",evaluationVisibility:"public",ratingSteps:"10"}));
  expect(result).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("requires explicit confirmation for all-private and deletion",async()=>{
  expect(await makeAllLibraryPrivate(null,form({}))).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  expect(await bulkLibraryChange(null,form({selection:id+":1",operation:"delete"}))).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("reports version conflicts safely and never reveals DB details",async()=>{
  mocks.rpc.mockResolvedValue({error:{message:"CONFLICT"}});
  expect(await copyWorkToLibrary(null,form({workId:id}))).toMatchObject({ok:false,error:{code:"CONFLICT"}});
  mocks.rpc.mockResolvedValue({error:{message:"private-note-secret",code:"XX000"}});
  const result = await copyWorkToLibrary(null,form({workId:id}));
  expect(result).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});expect(JSON.stringify(result)).not.toContain("private-note-secret");
 });
});
