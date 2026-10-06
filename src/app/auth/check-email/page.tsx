import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailForm, SignOutForm } from "@/components/auth/auth-forms";
import { getCurrentAccount } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isUsernameAccount } from "@/lib/auth/username";
export const metadata = {title:"이메일 확인"};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getCurrentAccount();
  if (account && isUsernameAccount(account.user)) redirect("/me/library");
  if (!account) return <AuthShell title="이메일 확인 없이 시작해요." description="아이디와 비밀번호로 가입할 수 있어요."><Link className="button button-primary" href="/auth/sign-up">회원가입</Link><Link className="text-link" href="/auth/sign-in">로그인</Link></AuthShell>;
  return <AuthShell title="받은편지함을 확인해요." description="확인 메일의 링크를 열고, 이메일 확인 버튼을 눌러 주세요."><CheckEmailForm missingContact={Boolean(account && !account.user.email)}/>{account ? <SignOutForm/> : null}</AuthShell>;
}
