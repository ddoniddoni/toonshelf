import "server-only";
import { createHash } from "node:crypto";
import { AuthFailure,actionError } from "@/lib/auth/errors";
import { getPublicEnv } from "@/lib/env/public";
import { imageRequestSchema,type TierImageSource } from "./image-model";

export const tierImageHeaders={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow"};
export function imageFingerprint(value:unknown) {
  return createHash("sha256").update(JSON.stringify(value) ?? "null").digest("hex");
}
export function sameImageSource(before:TierImageSource,after:TierImageSource) {
  if (imageFingerprint(before) !== imageFingerprint(after))
    throw new AuthFailure("CONFLICT","이미지를 만드는 동안 티어표나 작품 정보가 바뀌었어요. 최신 내용을 확인하고 다시 저장해 주세요.");
}
export async function readImageRequest(request:Request) {
  // Route handlers need their own CSRF boundary; Server Action checks do not
  // apply here. Never accept cross-origin requests or tokens in a query string.
  const expected=new URL(getPublicEnv().siteUrl).origin;
  if (request.headers.get("origin") !== expected) throw new AuthFailure("FORBIDDEN","현재 서비스 페이지에서 이미지 저장을 요청해 주세요.");
  if (new URL(request.url).search || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    throw new AuthFailure("VALIDATION_ERROR","이미지 저장 요청을 확인해 주세요.");
  const reader=request.body?.getReader();if (!reader) throw new AuthFailure("VALIDATION_ERROR","이미지 저장 요청을 확인해 주세요.");
  const chunks:Uint8Array[]=[];let size=0;
  try {
    for (;;) {
      const {value,done}=await reader.read();if (done) break;
      size+=value.byteLength;
      if (size > 2048) {await reader.cancel();throw new AuthFailure("VALIDATION_ERROR","이미지 저장 요청이 너무 커요.");}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  let input:unknown;
  try {input=JSON.parse(Buffer.concat(chunks).toString("utf8"));}
  catch {throw new AuthFailure("VALIDATION_ERROR","이미지 저장 요청을 확인해 주세요.");}
  return imageRequestSchema.parse(input);
}
export function imageErrorResponse(error:unknown) {
  const result=actionError(error),code=result.error.code;
  const status=code === "NOT_FOUND" ? 404 : code === "AUTH_REQUIRED" ? 401 : code === "CONFLICT" ? 409
    : code === "VALIDATION_ERROR" ? 400 : code === "RATE_LIMITED" ? 429
    : ["FORBIDDEN","EMAIL_UNVERIFIED","ONBOARDING_REQUIRED"].includes(code) ? 403 : code === "CONFIG_REQUIRED" ? 503 : 500;
  return Response.json(result,{status,headers:{...tierImageHeaders,...(code === "RATE_LIMITED" ? {"Retry-After":"600"} : {})}});
}
