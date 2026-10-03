import "server-only";
import { AuthFailure } from "@/lib/auth/errors";

export function catalogueError(error:{code?:string;message?:string}|null) {
  if (!error) return;
  const messages = {
    AUTH_REQUIRED:"로그인이 필요해요.",EMAIL_UNVERIFIED:"이메일 인증을 먼저 완료해 주세요.",ONBOARDING_REQUIRED:"온보딩과 동의를 완료해 주세요.",
    FORBIDDEN:"이 작업에 필요한 권한이 없어요.",NOT_FOUND:"대상을 찾을 수 없어요.",VALIDATION_ERROR:"작품 정보와 출처·등급·링크를 확인해 주세요.",
    CONFLICT:"중복된 링크·식별자가 있거나 기록이 바뀌었어요. 다른 작업이 진행 중일 수도 있으니 최신 내용을 다시 확인해 주세요.",RATE_LIMITED:"요청이 많아요. 잠시 후 다시 시도해 주세요."
  } as const;
  if (error.code === "23505") throw new AuthFailure("CONFLICT",messages.CONFLICT);
  if (error.message === "MERGE_REQUIRES_DOMAIN_HANDLERS") throw new AuthFailure("CONFLICT","개인 기록을 보존하는 병합 처리가 먼저 필요해요. 지금은 병합할 수 없어요.");
  if (error.message === "MERGE_PREVIEW_EXPIRED") throw new AuthFailure("CONFLICT","미리보기 이후 기록이 바뀌었거나 유효 시간이 지났어요. 병합 미리보기를 다시 열어 주세요.");
  if (error.message === "MERGE_RECORD_CONFLICT") throw new AuthFailure("CONFLICT","개인 기록 충돌이 있어 병합을 중단했어요. 미리보기에서 충돌 건수를 다시 확인해 주세요.");
  const key = Object.keys(messages).find(k=>k === error.message) as keyof typeof messages|undefined;
  if (key) throw new AuthFailure(key,messages[key]);
  throw new AuthFailure("INTERNAL_ERROR","카탈로그 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
}
