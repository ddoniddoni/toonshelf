import Link from "next/link";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordForm } from "@/components/auth/auth-forms";
import { getCurrentAccount } from "@/lib/auth/session";
import { ticketCookie } from "@/lib/auth/reauth";
export const metadata = {title:"비밀번호 재설정"};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getCurrentAccount(); const token = (await cookies()).get(ticketCookie("password_reset"))?.value;
  const permitted = Boolean(account?.user.email_confirmed_at && account.access.status !== "suspended" && account.access.status !== "deleting" && token && /^[A-Za-z0-9_-]{43}$/.test(token));
  return <AuthShell title="새 비밀번호를 정해요." description="이전과 다른 비밀번호로 서재를 보호하세요.">{permitted ? <PasswordForm recovery/> : <><p>복구 메일을 확인한 뒤에만 비밀번호를 재설정할 수 있어요.</p><Link className="text-link" href="/auth/forgot-password">새 복구 메일 받기</Link></>}</AuthShell>;
}
