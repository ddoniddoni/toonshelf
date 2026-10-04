import "server-only";
import { AuthFailure, databaseError } from "@/lib/auth/errors";
export function tierError(error:{code?:string;message?:string}|null) {
 if (!error) return;
 const messages={NOT_FOUND:"티어 초안을 찾을 수 없어요.",TIER_LIMIT:"티어표는 최대 50개까지 만들 수 있어요.",WORK_UNAVAILABLE:"현재 추가할 수 없는 작품이 있어요. 목록을 다시 확인해 주세요.",CONFLICT:"다른 화면이나 작품 병합으로 초안이 바뀌었어요. 최신 내용을 불러오거나 지금 편집본을 새 티어표로 저장해 주세요.",VALIDATION_ERROR:"제목·행·태그·작품 배치와 제한을 확인해 주세요."} as const;
 const code=Object.keys(messages).find(k=>k === error.message) as keyof typeof messages|undefined;
 if (code) throw new AuthFailure(code === "NOT_FOUND" || code === "CONFLICT" ? code : "VALIDATION_ERROR",messages[code]);
 if (error.message === "CONFIRM_REQUIRED") throw new AuthFailure("VALIDATION_ERROR","작업 내용을 확인하고 동의해 주세요.");
 if (["22P02","22003","23514"].includes(error.code ?? "")) throw new AuthFailure("VALIDATION_ERROR",messages.VALIDATION_ERROR);
 databaseError(error);
}
export function publicationError(error:{code?:string;message?:string}|null) {
 if (error?.message === "CONFLICT") throw new AuthFailure("CONFLICT","다른 화면이나 작품 정보 변경으로 티어표 상태가 바뀌었어요. 최신 상태와 미리보기를 불러와 다시 확인해 주세요.");
 if (error?.message === "NOT_FOUND") throw new AuthFailure("NOT_FOUND","현재 접근할 수 있는 티어표를 찾을 수 없어요.");
 tierError(error);
}
export function evaluationError(error:{code?:string;message?:string}|null) {
 if (error?.message === "CONFLICT") throw new AuthFailure("CONFLICT","초안·개인 기록·작품 정보가 바뀌었어요. 최신 목록을 불러와 변경 내용을 다시 확인해 주세요.");
 if (error?.message === "READING_STATUS_REQUIRED") throw new AuthFailure("VALIDATION_ERROR","새 기록이나 나중에 볼 작품은 보는 중·완독·중도하차 중 읽기 상태를 직접 선택해 주세요.");
 if (error?.message === "TIER_CAPACITY") throw new AuthFailure("VALIDATION_ERROR","가져오면 300작품 제한을 넘어요. 선택한 작품 수를 줄이거나 초안을 정리해 주세요.");
 tierError(error);
}
export function likeError(error:{code?:string;message?:string}|null) {
 if (error?.message === "SELF_REACTION") throw new AuthFailure("FORBIDDEN","내 티어표에는 좋아요를 표시할 수 없어요.");
 if (error?.message === "CONFLICT") throw new AuthFailure("CONFLICT","티어표의 게시 상태가 바뀌었어요. 최신 게시본과 좋아요 상태를 다시 확인해 주세요.");
 if (error?.message === "NOT_FOUND") throw new AuthFailure("NOT_FOUND","현재 좋아요를 표시할 수 있는 공개 티어표가 없어요.");
 tierError(error);
}
export function featuredError(error:{code?:string;message?:string}|null) {
 if (error?.message === "CONFLICT") throw new AuthFailure("CONFLICT","대표 지정이나 티어표 게시 상태가 바뀌었어요. 최신 상태를 불러와 다시 선택해 주세요.");
 if (error?.message === "FEATURED_UNAVAILABLE") throw new AuthFailure("FORBIDDEN","현재 전체 공개된 내 티어표만 대표로 지정할 수 있어요.");
 if (error?.message === "NOT_FOUND") throw new AuthFailure("NOT_FOUND","대표로 지정할 내 티어표를 찾을 수 없어요.");
 tierError(error);
}
