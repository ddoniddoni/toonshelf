import { z } from "zod";

export const POLICY_VERSION = "2026-10-02-preview";
export const RESERVED_USERNAMES = ["admin","auth","api","support","settings","onboarding","toonshelf","system","moderator"];
const text = (min: number, max: number) => z.string().trim().refine((s) => [...s].length >= min && [...s].length <= max, `${min}~${max}자로 입력해 주세요.`);
export const emailSchema = z.email("이메일 주소를 확인해 주세요.").max(254).transform((s) => s.trim().toLowerCase());
export const passwordSchema = z.string().refine((s) => [...s].length >= 12 && [...s].length <= 128, "비밀번호는 공백을 포함해 12~128자로 입력해 주세요.");
export const usernameSchema = z.string().regex(/^[a-z0-9_]{3,20}$/, "영문 소문자·숫자·밑줄 3~20자를 사용해 주세요.").refine((s) => !RESERVED_USERNAMES.includes(s), "사용할 수 없는 사용자 이름이에요.");
export const consentSchema = z.object({ terms: z.literal(true, "이용약관에 동의해 주세요."), privacy: z.literal(true, "개인정보 처리 안내에 동의해 주세요."), age14: z.literal(true, "14세 이상만 가입할 수 있어요.") });
export const signUpSchema = consentSchema.extend({ email: emailSchema, password: passwordSchema, confirmPassword: z.string() }).refine((s) => s.password === s.confirmPassword, { path: ["confirmPassword"], message: "비밀번호가 일치하지 않아요." });
export const signInSchema = z.object({ email: emailSchema, password: z.string().min(1).max(512) });
export const newPasswordSchema = z.object({ password: passwordSchema, confirmPassword: z.string(), nonce: z.string().regex(/^\d{6,10}$/).optional() }).refine((s) => s.password === s.confirmPassword, { path: ["confirmPassword"], message: "비밀번호가 일치하지 않아요." });
export const profileSchema = z.object({ displayName: text(2,30), bio: text(0,160), discoveryOptIn: z.boolean() });
export const notificationsSchema = z.strictObject({ followers: z.boolean(), replies: z.boolean(), reactions: z.boolean(), announcements: z.boolean() });
export const settingsSchema = z.object({ library: z.enum(["private","public"]), evaluation: z.enum(["private","public"]), theme: z.enum(["system","light","dark"]), timezone: z.string().max(100).refine((s) => { try { new Intl.DateTimeFormat("ko", { timeZone: s }); return true; } catch { return false; } }, "시간대를 확인해 주세요."), genres: z.array(z.uuid()).max(12).refine((s) => new Set(s).size === s.length), notifications: notificationsSchema });
export const onboardingSchema = consentSchema.extend({ username: usernameSchema, displayName: text(2,30), bio: text(0,160), library: z.enum(["private","public"]), evaluation: z.enum(["private","public"]), genres: z.array(z.uuid()).max(12).refine((s) => new Set(s).size === s.length), policyVersion: z.literal(POLICY_VERSION) });
export const confirmationSchema = z.object({ tokenHash: z.string().regex(/^[a-f0-9]{32,128}$/i), type: z.enum(["email","recovery","email_change"]) });
export const accessSchema = z.object({ status: z.enum(["pending","active","suspended","deleting"]), consents_current: z.boolean() });
export const sessionIdSchema = z.uuid();
export const purposeSchema = z.enum(["password_reset","password_change","email_change","account_delete"]);
export type ReauthPurpose = z.infer<typeof purposeSchema>;
export const field = (form: FormData, name: string) => { const value = form.get(name); return typeof value === "string" ? value : ""; };
export const checked = (form: FormData, name: string) => form.get(name) === "on";
export const genreFields = (form: FormData) => form.getAll("genres").filter((s): s is string => typeof s === "string");

export function safeReturnTo(input: unknown, fallback = "/me/library") {
  if (typeof input !== "string" || input.length > 512 || !input.startsWith("/") || input.startsWith("//") || /[\s\\\u0000-\u001f\u007f]/.test(input) || /%(?:2f|5c|25|0[0-9a-f]|1[0-9a-f]|7f)/i.test(input)) return fallback;
  try {
    const url = new URL(input, "https://toonshelf.invalid");
    if (url.origin !== "https://toonshelf.invalid" || /^\/(?:auth|onboarding)(?:\/|$)/i.test(decodeURIComponent(url.pathname)) || ["token_hash","code","recovery"].some((key) => url.searchParams.has(key))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
