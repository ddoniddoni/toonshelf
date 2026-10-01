import { AuthShell } from "@/components/auth/auth-shell";
import { CheckEmailForm, SignOutForm } from "@/components/auth/auth-forms";
import { getCurrentAccount } from "@/lib/auth/session";
export const metadata = {title:"이메일 확인"};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await getCurrentAccount();
  return <AuthShell title="받은편지함을 확인해요." description="확인 메일의 링크를 열고, 이메일 확인 버튼을 눌러 주세요."><CheckEmailForm missingContact={Boolean(account && !account.user.email)}/>{account ? <SignOutForm/> : null}</AuthShell>;
}
