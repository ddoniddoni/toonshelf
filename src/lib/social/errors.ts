import "server-only";
import { AuthFailure,databaseError } from "@/lib/auth/errors";

export function followError(error:{code?:string;message?:string}|null) {
 if (!error) return;
 if (error.message === "SELF_FOLLOW") throw new AuthFailure("FORBIDDEN","자신을 팔로우할 수 없어요.");
 if (error.message === "NOT_FOUND") throw new AuthFailure("NOT_FOUND","현재 팔로우하거나 열람할 수 없는 프로필이에요.");
 if (["40P01","55P03","57014"].includes(error.code ?? "")) throw new AuthFailure("CONFLICT","다른 요청을 처리 중이에요. 현재 팔로우 상태를 다시 확인해 주세요.");
 databaseError(error);
}
