import "server-only";
import { ZodError } from "zod";
import { ConfigurationError } from "@/lib/env/schema";
import type { ActionResult } from "@/types/result";

type Code = Extract<ActionResult<never>, {ok: false}>["error"]["code"];
export class AuthFailure extends Error {
  constructor(public code: Code, message: string) { super(message); }
}
export function databaseError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "23505") throw new AuthFailure("CONFLICT", "이미 사용 중인 사용자 이름이에요.");
  const messages: Partial<Record<Code, string>> = { AUTH_REQUIRED: "로그인이 필요해요.", EMAIL_UNVERIFIED: "먼저 이메일 주소를 확인해 주세요.", ONBOARDING_REQUIRED: "프로필 설정과 필수 동의를 완료해 주세요.", FORBIDDEN: "이 작업을 진행할 수 없어요. 계정 상태나 재인증을 확인해 주세요.", VALIDATION_ERROR: "입력 내용을 확인해 주세요.", RATE_LIMITED: "요청이 많아요. 잠시 후 다시 시도해 주세요." };
  const code = Object.keys(messages).find((s) => error.message === s) as Code | undefined;
  if (code) throw new AuthFailure(code, messages[code]!);
  throw new AuthFailure("INTERNAL_ERROR", "계정 데이터를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}
export function actionError(error: unknown): Extract<ActionResult<never>, {ok: false}> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) { const key = String(issue.path[0] ?? "form"); (fieldErrors[key] ??= []).push(issue.message); }
    return {ok:false,error:{code:"VALIDATION_ERROR",message:"입력 내용을 확인해 주세요.",fieldErrors}};
  }
  if (error instanceof ConfigurationError) return {ok:false,error:{code:"CONFIG_REQUIRED",message:"계정 기능을 이용하려면 서비스 연결 설정이 필요해요."}};
  if (error instanceof AuthFailure) return {ok:false,error:{code:error.code,message:error.message}};
  return {ok:false,error:{code:"INTERNAL_ERROR",message:"요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요."}};
}
