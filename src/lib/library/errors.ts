import "server-only";
import { AuthFailure, databaseError } from "@/lib/auth/errors";
export function libraryError(error:{code?:string;message?:string}|null) {
 if (!error) return;
 const messages = {
  CONFLICT:"다른 화면에서 기록이 바뀌었어요. 새로고침해서 최신 내용을 확인한 뒤 다시 저장해 주세요.",
  NOT_FOUND:"현재 기록하거나 공개할 수 없는 작품이에요.",
  CLEAR_EVALUATION_REQUIRED:"나중에 볼 작품으로 바꾸면 별점과 기본 티어가 삭제돼요. 삭제에 동의해 주세요.",
  PLANNED_EVALUATION:"나중에 볼 작품에는 평가를 저장할 수 없어요. 읽기 상태를 바꿔 주세요.",
  CONFIRM_REQUIRED:"삭제하거나 모두 비공개로 바꿀 범위를 확인하고 동의해 주세요.",
  VALIDATION_ERROR:"기록 내용과 공개 범위를 확인해 주세요."
 } as const;
 const code = Object.keys(messages).find(k=>k === error.message) as keyof typeof messages|undefined;
 if (code) throw new AuthFailure(code === "CONFLICT" || code === "NOT_FOUND" ? code : "VALIDATION_ERROR",messages[code]);
 if (["22P02","22007","22008","22003","23514"].includes(error.code ?? "")) throw new AuthFailure("VALIDATION_ERROR",messages.VALIDATION_ERROR);
 if (error.code === "23505") throw new AuthFailure("CONFLICT",messages.CONFLICT);
 databaseError(error);
}
