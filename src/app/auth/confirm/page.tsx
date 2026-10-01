import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmationForm } from "@/components/auth/auth-forms";
import { confirmationSchema, safeReturnTo } from "@/lib/auth/validation";
export const metadata = {title:"이메일 확인",referrer:"no-referrer" as const};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = await searchParams;
  const input = confirmationSchema.safeParse({tokenHash:params.token_hash,type:params.type});
  return <AuthShell title="이메일을 확인할까요?" description="직접 요청한 확인 메일인지 확인한 뒤 계속해 주세요.">{input.success ? <ConfirmationForm {...input.data} returnTo={safeReturnTo(params.returnTo)}/> : <><p role="alert">올바른 확인 링크가 아니에요. 새 메일을 요청해 주세요.</p><Link className="text-link" href="/auth/check-email">인증 메일 다시 받기</Link><Link className="text-link" href="/auth/forgot-password">비밀번호 복구 메일 받기</Link></>}</AuthShell>;
}
