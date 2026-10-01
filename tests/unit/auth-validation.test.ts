import { describe, expect, it } from "vitest";
import { confirmationSchema, notificationsSchema, onboardingSchema, passwordSchema, POLICY_VERSION, profileSchema, safeReturnTo, signUpSchema, usernameSchema } from "@/lib/auth/validation";

describe("authentication input boundaries", () => {
  it.each(["https://evil.example/path","//evil.example","/\\evil.example","/%2fevil.example","/%252fevil.example","/foo/../auth/callback","/auth/sign-in","/AUTH/sign-in","/onboarding","/me/library?token_hash=hidden","/me/library?code=hidden","/me/library\n","javascript:alert(1)",undefined,["/me/library"]])("rejects redirect escape or auth loops: %s", (path) => {
    expect(safeReturnTo(path)).toBe("/me/library");
  });
  it("preserves the original internal destination", () => {
    expect(safeReturnTo("/settings/privacy?tab=privacy#settings")).toBe("/settings/privacy?tab=privacy#settings");
  });
  it("does not trim significant password spaces", () => {
    const password = "  twelve spaces  ";
    expect(passwordSchema.parse(password)).toBe(password);
  });
  it("counts password Unicode code points rather than UTF-16 units", () => {
    expect(passwordSchema.safeParse("🔐".repeat(11)).success).toBe(false);
    expect(passwordSchema.safeParse("🔐".repeat(12)).success).toBe(true);
    expect(passwordSchema.safeParse("🔐".repeat(129)).success).toBe(false);
  });
  it("requires all signup consents and matching passwords", () => {
    const input = {email:"reader@example.test",password:"valid-password",confirmPassword:"valid-password",terms:true,privacy:true,age14:true};
    expect(signUpSchema.safeParse(input).success).toBe(true);
    expect(signUpSchema.safeParse({...input,terms:false}).success).toBe(false);
    expect(signUpSchema.safeParse({...input,confirmPassword:"different"}).success).toBe(false);
  });
  it.each(["admin","auth","api","support","UpperCase","ab","spaces here","../user"])('rejects unsafe username "%s"',(username) => {
    expect(usernameSchema.safeParse(username).success).toBe(false);
  });
  it("rejects legacy or invented confirmation purposes", () => {
    const tokenHash = "a".repeat(64);
    expect(confirmationSchema.safeParse({tokenHash,type:"recovery"}).success).toBe(true);
    expect(confirmationSchema.safeParse({tokenHash,type:"password_reset"}).success).toBe(false);
    expect(confirmationSchema.safeParse({tokenHash,type:"invite"}).success).toBe(false);
    expect(confirmationSchema.safeParse({tokenHash:"not-a-hash",type:"email"}).success).toBe(false);
  });
  it("requires current versioned consent and distinct existing genre IDs", () => {
    const input = {username:"reader_1",displayName:"독자",bio:"",library:"private",evaluation:"private",genres:[],policyVersion:POLICY_VERSION,terms:true,privacy:true,age14:true};
    expect(onboardingSchema.safeParse(input).success).toBe(true);
    expect(onboardingSchema.safeParse({...input,policyVersion:"old-policy"}).success).toBe(false);
    expect(onboardingSchema.safeParse({...input,age14:false}).success).toBe(false);
    const genre = "11111111-1111-4111-8111-111111111111";
    expect(onboardingSchema.safeParse({...input,genres:[genre,genre]}).success).toBe(false);
  });
  it("accepts Korean display names and enforces code point limits", () => {
    expect(profileSchema.safeParse({displayName:"📚".repeat(30),bio:"한글 소개",discoveryOptIn:false}).success).toBe(true);
    expect(profileSchema.safeParse({displayName:"📚".repeat(31),bio:"",discoveryOptIn:false}).success).toBe(false);
    expect(profileSchema.safeParse({displayName:"독자",bio:"가".repeat(161),discoveryOptIn:false}).success).toBe(false);
  });
  it("does not accept arbitrary notification data", () => {
    const value = {followers:true,replies:false,reactions:false,announcements:true};
    expect(notificationsSchema.safeParse(value).success).toBe(true);
    expect(notificationsSchema.safeParse({...value,role:"admin"}).success).toBe(false);
    expect(notificationsSchema.safeParse({...value,replies:"true"}).success).toBe(false);
  });
});
