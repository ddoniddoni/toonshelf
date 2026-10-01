import "server-only";
import { AuthFailure } from "@/lib/auth/errors";

export function catalogueError(error:{code?:string;message?:string}|null) {
  if (!error) return;
  const messages = {
    AUTH_REQUIRED:"로그인이 필요해요.",EMAIL_UNVERIFIED:"이메일 인증을 먼저 완료해 주세요.",ONBOARDING_REQUIRED:"온보딩과 동의를 완료해 주세요.",
    FORBIDDEN:"이 작업에 필요한 권한이 없어요.",NOT_FOUND:"대상을 찾을 수 없어요.",VALIDATION_ERROR:"작품 정보와 출처·등급·링크를 확인해 주세요.",
    CONFLICT:"중복된 링크·식별자가 있거나 다른 관리자가 수정했어요. 최신 내용을 확인해 주세요.",RATE_LIMITED:"요청이 많아요. 잠시 후 다시 시도해 주세요."
  } as const;
  if (error.code === "23505") throw new AuthFailure("CONFLICT",messages.CONFLICT);
  if (error.message === "MERGE_REQUIRES_DOMAIN_HANDLERS") throw new AuthFailure("CONFLICT","개인 기록을 보존하는 병합 처리가 먼저 필요해요. 지금은 병합할 수 없어요.");
  const key = Object.keys(messages).find(k=>k === error.message) as keyof typeof messages|undefined;
  if (key) throw new AuthFailure(key,messages[key]);
  throw new AuthFailure("INTERNAL_ERROR","카탈로그 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}
