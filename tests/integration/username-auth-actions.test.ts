// @vitest-environment node
// Written mock boundary tests only; no live Supabase signup evidence.
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({client:vi.fn(),reserve:vi.fn(),create:vi.fn(),login:vi.fn(),destination:vi.fn(),redirect:vi.fn(),open:vi.fn(),require:vi.fn(),update:vi.fn(),rate:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({rpc:mocks.reserve,auth:{admin:{createUser:mocks.create}}})}));
vi.mock("@/lib/auth/config",()=>({registrationOpen:mocks.open}));
vi.mock("@/lib/auth/session",()=>({memberDestination:mocks.destination,requireAccount:mocks.require,getCurrentAccount:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
import { changePassword, requestRecovery, sendReauthOtp, signIn, signUp } from "@/lib/auth/actions";
const form=(values:Record<string,string>)=>{const data=new FormData();for(const [key,value] of Object.entries(values))data.set(key,value);return data;};
const signup=()=>form({username:"reader_1",password:"valid-password",confirmPassword:"valid-password",terms:"on",privacy:"on",age14:"on",role:"admin",email_confirm:"false"});
describe("username registration and shared Auth isolation",()=>{
  beforeEach(()=>{
    vi.resetAllMocks();
    mocks.open.mockReturnValue(true);
    mocks.reserve.mockResolvedValue({data:true,error:null});
    mocks.create.mockResolvedValue({data:{user:{id:"new-member"}},error:null});
    mocks.login.mockResolvedValue({data:{user:{id:"new-member"}},error:null});
    mocks.client.mockResolvedValue({auth:{signInWithPassword:mocks.login}});
    mocks.destination.mockResolvedValue("/me/library");
    mocks.redirect.mockImplementation((path:string)=>{throw new Error(`redirect:${path}`);});
  });
  it("rejects missing consent before any privileged operation",async()=>{
    const data=signup();data.delete("terms");
    expect(await signUp(null,data)).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
    expect(mocks.reserve).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
  });
  it("honors the registration gate and the committed signup reservation",async()=>{
    mocks.open.mockReturnValueOnce(false);
    expect(await signUp(null,signup())).toMatchObject({ok:false,error:{code:"CONFIG_REQUIRED"}});
    mocks.reserve.mockResolvedValueOnce({data:false,error:null});
    expect(await signUp(null,signup())).toMatchObject({ok:false,error:{code:"RATE_LIMITED"}});
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates an app-marked identity without taking role or confirmation from the form",async()=>{
    await expect(signUp(null,signup())).rejects.toThrow("redirect:/me/library");
    const input=mocks.create.mock.calls[0][0];
    expect(input).toMatchObject({email:"reader_1@username.toonshelf.invalid",email_confirm:true,app_metadata:{toonshelf:{auth_mode:"username",username:"reader_1",consents:{terms:true,privacy:true,age_14:true}}}});
    expect(input.role).toBeUndefined();expect(input.user_metadata).toBeUndefined();
    expect(mocks.login).toHaveBeenCalledWith({email:"reader_1@username.toonshelf.invalid",password:"valid-password"});
  });
  it("does not overwrite or sign in an existing identity on duplicate signup",async()=>{
    mocks.create.mockResolvedValue({data:{user:null},error:{code:"email_exists"}});
    expect(await signUp(null,signup())).toMatchObject({ok:false,error:{code:"CONFLICT"}});
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("does not claim signup succeeded when the Auth transaction fails",async()=>{
    mocks.create.mockResolvedValue({data:{user:null},error:{code:"unexpected_failure",message:"private DB details"}});
    const result=await signUp(null,signup());
    expect(result).toMatchObject({ok:false});expect(JSON.stringify(result)).not.toContain("private DB details");
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("preserves successful registration if immediate session creation fails",async()=>{
    mocks.login.mockResolvedValue({error:{code:"over_request_rate_limit"}});
    await expect(signUp(null,signup())).rejects.toThrow("redirect:/auth/sign-in?registered=1");
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("does not authenticate arbitrary email accounts from the shared project",async()=>{
    expect(await signIn(null,form({username:"foreign@example.test",password:"valid-password"}))).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("does not send mail for username account recovery or reauthentication",async()=>{
    mocks.require.mockResolvedValue({user:{app_metadata:{toonshelf:{auth_mode:"username"}},email:"reader_1@username.toonshelf.invalid"}});
    expect(await requestRecovery(null,form({email:"reader_1@username.toonshelf.invalid"}))).toMatchObject({ok:false,error:{code:"CONFIG_REQUIRED"}});
    expect(await sendReauthOtp()).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("requires the current password and the same Auth identity before changing a password",async()=>{
    mocks.rate.mockResolvedValue({error:null});
    mocks.require.mockResolvedValue({user:{id:"new-member",app_metadata:{toonshelf:{auth_mode:"username"}},email:"reader_1@username.toonshelf.invalid"},client:{rpc:mocks.rate,auth:{signInWithPassword:mocks.login,updateUser:mocks.update}}});
    const fields={password:"new-valid-password",confirmPassword:"new-valid-password"};
    expect(await changePassword(null,form(fields))).toMatchObject({ok:false,error:{code:"VALIDATION_ERROR"}});
    mocks.login.mockResolvedValue({data:{user:{id:"another-member"}},error:null});
    expect(await changePassword(null,form({...fields,currentPassword:"valid-password"}))).toMatchObject({ok:false,error:{code:"FORBIDDEN"}});
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
