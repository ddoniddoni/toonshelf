import { AccountShell } from "@/components/account/account-shell";
import { EmailChangeForm, ReauthForm } from "@/components/account/account-forms";
import { PasswordForm, SignOutForm } from "@/components/auth/auth-forms";
import { guardPage } from "@/lib/auth/session";
import { isUsernameAccount } from "@/lib/auth/username";
export const metadata = {title:"로그인과 보안"};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await guardPage("/settings/account");
  const usernameAccount = Boolean(account && isUsernameAccount(account.user));
  return <AccountShell title="로그인과 보안" description="중요한 변경 전에는 현재 계정인지 한 번 더 확인해요." connected={Boolean(account)}>{account ? <>{usernameAccount ? <div className="account-section"><h2>로그인 방식</h2><p>아이디와 비밀번호로 로그인해요. 연락 이메일은 등록하지 않았어요.</p></div> : <div className="account-section"><h2>계정 확인</h2><p className="field-hint">확인은 선택한 작업에 한 번만 사용할 수 있어요.</p><ReauthForm hasPassword={Boolean(account.user.identities?.some((i)=>i.provider === "email"))}/></div>}<div className="account-section"><h2>비밀번호 변경</h2><PasswordForm usernameAccount={usernameAccount}/></div>{usernameAccount ? null : <div className="account-section"><h2>이메일 변경</h2><p className="field-hint">현재 이메일: {account.user.email}</p><EmailChangeForm/></div>}<div className="account-section"><h2>이 기기에서 로그아웃</h2><SignOutForm/></div><div className="account-section"><h2>데이터와 탈퇴</h2><p>탈퇴하면 공개 기록이 숨겨지고 개인 기록·파일·인증 계정이 정리돼요. 데이터 내보내기와 탈퇴 기능은 아직 준비 중이에요.</p><button className="button button-secondary" disabled>계정 탈퇴 준비 중</button></div></> : null}</AccountShell>;
}
