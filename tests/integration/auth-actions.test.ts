// @vitest-environment node
// Mock-based server boundary checks; not evidence of live Supabase Auth.
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks = vi.hoisted(()=>({require:vi.fn(),client:vi.fn(),rpc:vi.fn(),recover:vi.fn(),consume:vi.fn(),issue:vi.fn(),admin:vi.fn(),redirect:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.require,getCurrentAccount:vi.fn(),memberDestination:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:mocks.admin}));
vi.mock("@/lib/auth/reauth",()=>({consumeTicket:mocks.consume,issueTicket:mocks.issue,privateCookieOptions:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:()=>({siteUrl:"http://localhost:3000",supabase:{url:"http://127.0.0.1:55321",key:"sb_publishable_test_only"}}),requireSupabaseEnv:()=>({url:"http://127.0.0.1:55321",key:"sb_publishable_test_only"})}));
import { completeOnboarding, reauthenticate, requestRecovery, resetPassword, saveProfile } from "@/lib/auth/actions";
import { AuthFailure } from "@/lib/auth/errors";
const form = (fields:Record<string,string>) => { const value=new FormData(); for(const [name,text] of Object.entries(fields)) value.set(name,text); return value; };
describe("server account boundaries",()=>{
  beforeEach(()=>{
    vi.resetAllMocks();
    mocks.rpc.mockResolvedValue({error:null});
    mocks.require.mockResolvedValue({user:{id:"verified-owner"},client:{rpc:mocks.rpc}});
    mocks.client.mockResolvedValue({auth:{resetPasswordForEmail:mocks.recover}});
  });
  it("rechecks access in the profile action when the UI is bypassed",async()=>{
    mocks.require.mockRejectedValue(new AuthFailure("FORBIDDEN","접근 불가"));
    const result=await saveProfile(null,form({displayName:"공격자",bio:"",userId:"someone-else",isAdmin:"true"}));
    expect(result).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not use client-supplied ownership or role values",async()=>{
    await saveProfile(null,form({displayName:"내 닉네임",bio:"",userId:"another-user",role:"admin"}));
    const args=mocks.rpc.mock.calls[0][1];
    expect(JSON.stringify(args)).not.toContain("another-user");
    expect(JSON.stringify(args)).not.toContain("admin");
  });
  it("does not call onboarding RPC without required consent",async()=>{
    const result=await completeOnboarding(null,form({username:"reader",displayName:"독자",bio:"",library:"private",evaluation:"private",policyVersion:"2026-10-02-preview",privacy:"on",age14:"on"}));
    expect(result).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not expose private database error text",async()=>{
    mocks.rpc.mockResolvedValue({error:{code:"XX000",message:"private_note=do-not-expose"}});
    const result=await saveProfile(null,form({displayName:"내 닉네임",bio:""}));
    expect(result).toMatchObject({ok:false,error:{code:"INTERNAL_ERROR"}});
    expect(JSON.stringify(result)).not.toContain("do-not-expose");
  });
  it("keeps mail recovery disabled without sending to shared-project identities",async()=>{
    const request=form({email:"reader@example.test"});
    mocks.recover.mockResolvedValueOnce({error:null});
    const existing=await requestRecovery(null,request);
    mocks.recover.mockResolvedValueOnce({error:{code:"user_not_found"}});
    const missing=await requestRecovery(null,request);
    expect(existing).toEqual(missing);
    expect(existing).toMatchObject({ok:false,error:{code:"CONFIG_REQUIRED"}});
    expect(mocks.recover).not.toHaveBeenCalled();
  });
  it("rejects normal-session reset even if recovery=true is supplied",async()=>{
    mocks.consume.mockRejectedValue(new AuthFailure("FORBIDDEN","복구 확인 필요"));
    const result=await resetPassword(null,form({password:"new-valid-password",confirmPassword:"new-valid-password",recovery:"true"}));
    expect(mocks.consume).toHaveBeenCalledWith("password_reset");
    expect(result).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
  });
  it("cannot mint a recovery proof through the account reauth action",async()=>{
    const result=await reauthenticate(null,form({purpose:"password_reset",method:"otp",otp:"123456"}));
    expect(result).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
    expect(mocks.issue).not.toHaveBeenCalled();
  });
});
