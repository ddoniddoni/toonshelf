import "server-only";
import { AuthFailure,databaseError } from "@/lib/auth/errors";
export function postError(error:{code?:string;message?:string}|null) {
 if(!error)return;
 // A missing RPC/table can mean a pending migration or a stale API schema cache.
 // The community page handles this state. Logging it as an error also opens
 // the Next.js development error overlay even when the exception is caught.
 if(["PGRST202","PGRST205","42883","42P01"].includes(error.code??"")) {
  throw new AuthFailure("CONFIG_REQUIRED","커뮤니티 기능을 준비하고 있어요. 잠시 후 다시 방문해 주세요.");
 }
 if(error.message==="SELF_REACTION")throw new AuthFailure("FORBIDDEN","내 글에는 좋아요를 표시할 수 없어요.");
 if(error.message==="CONFLICT" || ["23505","55P03","40P01"].includes(error.code??""))throw new AuthFailure("CONFLICT","글이나 초안이 변경됐어요. 입력한 내용을 보관하고 최신 화면에서 다시 진행해 주세요.");
 if(error.message==="NOT_FOUND")throw new AuthFailure("NOT_FOUND","지금 열람하거나 변경할 수 없는 글이에요.");
 if(error.message==="WORK_UNAVAILABLE")throw new AuthFailure("VALIDATION_ERROR","공개할 수 없는 연결 작품이 있어요. 해당 작품을 제거한 뒤 다시 저장해 주세요.");
 if(error.message==="MODERATION_HIDDEN")throw new AuthFailure("FORBIDDEN","운영자가 숨긴 글은 직접 재게시할 수 없어요.");
 if(error.message==="CONFIRM_REQUIRED")throw new AuthFailure("VALIDATION_ERROR","게시·공개 취소·삭제 내용을 확인해 주세요.");
 if(error.message==="VALIDATION_ERROR" || ["22P02","22003","23514"].includes(error.code??""))throw new AuthFailure("VALIDATION_ERROR","제목·본문·연결 작품·신고 내용을 확인해 주세요.");
 const code=error.code && /^(?:[0-9A-Z]{5}|PGRST[0-9X]{3})$/.test(error.code) ? error.code : "UNKNOWN";
 console.error("[posts] Database request failed",{code});
 databaseError(error);
}
