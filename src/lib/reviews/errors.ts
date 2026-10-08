import "server-only";
import { AuthFailure,databaseError } from "@/lib/auth/errors";
import { reviewApiUnavailable } from "./availability";
export function reviewError(error:{code?:string;message?:string}|null) {
 if (!error) return;
 if (reviewApiUnavailable(error)) throw new AuthFailure("CONFIG_REQUIRED","리뷰 좋아요·댓글 기능을 준비하고 있어요. 잠시 후 다시 방문해 주세요.");
 if (error.message === "SELF_REACTION") throw new AuthFailure("FORBIDDEN","내 리뷰에는 좋아요를 표시할 수 없어요.");
 if (["55P03","40P01","40001"].includes(error.code ?? "")) throw new AuthFailure("CONFLICT","다른 변경을 처리하고 있어요. 최신 내용을 확인한 뒤 다시 시도해 주세요.");
 if (error.message === "CONFLICT" || error.code === "23505") throw new AuthFailure("CONFLICT","리뷰나 초안이 다른 화면에서 바뀌었어요. 최신 내용을 확인한 뒤 다시 진행해 주세요.");
 if (error.message === "NOT_FOUND") throw new AuthFailure("NOT_FOUND","지금 열람하거나 변경할 수 없는 리뷰예요.");
 if (error.message === "MODERATION_HIDDEN") throw new AuthFailure("FORBIDDEN","운영자가 숨긴 리뷰는 직접 다시 게시할 수 없어요.");
 if (error.message === "CONFIRM_REQUIRED") throw new AuthFailure("VALIDATION_ERROR","게시·공개 취소·삭제 범위를 확인해 주세요.");
 if (error.message === "VALIDATION_ERROR" || ["22P02","22003","23514"].includes(error.code ?? "")) throw new AuthFailure("VALIDATION_ERROR","본문·회차·신고 사유를 확인해 주세요.");
 databaseError(error);
}
