import "server-only";
import { AuthFailure,databaseError } from "@/lib/auth/errors";
export function commentError(error:{code?:string;message?:string}|null) {
 if (!error) return;
 if (error.message === "CONFLICT" || error.code === "23505") throw new AuthFailure("CONFLICT","댓글이나 글 게시 상태가 바뀌었어요. 최신 내용을 불러와 다시 확인해 주세요.");
 if (error.message === "NOT_FOUND") throw new AuthFailure("NOT_FOUND","현재 열람하거나 변경할 수 있는 댓글을 찾을 수 없어요.");
 if (["22P02","22003","23514","23503"].includes(error.code ?? "")) throw new AuthFailure("VALIDATION_ERROR","댓글 내용과 대상을 확인해 주세요.");
 databaseError(error);
}
