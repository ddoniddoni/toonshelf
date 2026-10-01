"use client";

import Link from "next/link";
import { ActionForm, Checkbox, Field } from "@/components/forms/action-form";
import { changePassword, confirmEmail, requestPasswordNonce, requestRecovery, resendEmail, resetPassword, setContactEmail, signIn, signOut, signUp } from "@/lib/auth/actions";

export function Consents() {
  return <fieldset className="form-consents"><legend>필수 확인</legend><Checkbox name="terms" required label={<><Link href="/legal/terms" target="_blank" rel="noopener noreferrer">이용약관</Link>에 동의해요</>}/><Checkbox name="privacy" required label={<><Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리 안내</Link>에 동의해요</>}/><Checkbox name="age14" required label="만 14세 이상이에요"/></fieldset>;
}
export function SignUpForm() {
  return <><ActionForm action={signUp} submitLabel="가입하고 확인 메일 받기"><Field name="email" label="이메일" type="email" autoComplete="email" required maxLength={254}/><Field name="password" label="비밀번호" type="password" autoComplete="new-password" required minLength={12} maxLength={256} hint="공백을 포함해 12~128자. 비밀번호는 자동으로 다듬지 않아요."/><Field name="confirmPassword" label="비밀번호 확인" type="password" autoComplete="new-password" required maxLength={256}/><Consents/></ActionForm><p className="form-bottom">이미 서재가 있나요? <Link href="/auth/sign-in">로그인</Link></p></>;
}
export function SignInForm({returnTo,error,google,kakao}: {returnTo:string;error:boolean;google:boolean;kakao:boolean}) {
  return <>{error ? <p className="form-feedback" role="alert">외부 로그인을 마치지 못했어요. 다시 시도하거나 기존 로그인 방법을 이용해 주세요.</p> : null}<ActionForm action={signIn} submitLabel="로그인"><input type="hidden" name="returnTo" value={returnTo}/><Field name="email" label="이메일" type="email" autoComplete="email" required maxLength={254}/><Field name="password" label="비밀번호" type="password" autoComplete="current-password" required maxLength={512}/><Link className="text-link" href="/auth/forgot-password">비밀번호를 잊었나요?</Link></ActionForm><div className="social-logins">{google ? <OAuthForm provider="google" returnTo={returnTo}/> : null}{kakao ? <OAuthForm provider="kakao" returnTo={returnTo}/> : null}{!google && !kakao ? <p className="field-hint">Google·카카오 로그인은 준비 중이에요.</p> : null}</div><p className="form-bottom">아직 서재가 없나요? <Link href="/auth/sign-up">회원가입</Link></p><Link className="text-link" href="/auth/check-email">인증 메일 다시 받기</Link></>;
}
function OAuthForm({provider,returnTo}: {provider:"google"|"kakao";returnTo:string}) {
  return <ActionForm action={signIn} submitLabel={`${provider === "google" ? "Google" : "카카오"}로 계속하기`}><input type="hidden" name="provider" value={provider}/><input type="hidden" name="returnTo" value={returnTo}/></ActionForm>;
}
export function CheckEmailForm({missingContact=false}: {missingContact?:boolean}) {
  return <><ActionForm action={missingContact ? setContactEmail : resendEmail} submitLabel={missingContact ? "연락 이메일 확인하기" : "인증 메일 다시 받기"}><Field name="email" label={missingContact ? "연락 이메일" : "가입한 이메일"} type="email" autoComplete="email" required maxLength={254} hint="이메일 주소는 공개 프로필에 표시하지 않아요."/></ActionForm><p className="field-hint">인증 메일은 최소 60초 간격으로 요청해 주세요.</p><Link className="text-link" href="/auth/sign-in">로그인으로 돌아가기</Link></>;
}
export function RecoveryForm() {
  return <ActionForm action={requestRecovery} submitLabel="복구 메일 받기"><Field name="email" label="이메일" type="email" autoComplete="email" required maxLength={254}/><Link className="text-link" href="/auth/sign-in">로그인으로 돌아가기</Link></ActionForm>;
}
export function ConfirmationForm({tokenHash,type,returnTo}: {tokenHash:string;type:"email"|"recovery"|"email_change";returnTo:string}) {
  return <><ActionForm action={confirmEmail} submitLabel={type === "recovery" ? "확인하고 비밀번호 재설정" : "이메일 확인하기"}><input type="hidden" name="tokenHash" value={tokenHash}/><input type="hidden" name="type" value={type}/><input type="hidden" name="returnTo" value={returnTo}/><p>아래 버튼을 누르면 확인 링크를 사용해요. 이 화면을 여는 것만으로는 링크를 사용하지 않아요.</p></ActionForm><Link className="text-link" href={type === "recovery" ? "/auth/forgot-password" : "/auth/check-email"}>새 확인 메일 받기</Link></>;
}
export function PasswordForm({recovery=false}: {recovery?:boolean}) {
  return <><ActionForm action={recovery ? resetPassword : changePassword} submitLabel="새 비밀번호 저장"><Field name="password" label="새 비밀번호" type="password" autoComplete="new-password" required minLength={12} maxLength={256}/><Field name="confirmPassword" label="새 비밀번호 확인" type="password" autoComplete="new-password" required maxLength={256}/><Field name="nonce" label="추가 확인 코드 (요청한 경우)" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10}/></ActionForm><details className="account-details"><summary>추가 확인 코드가 필요한가요?</summary><p>로그인한 지 오래된 계정은 메일 코드가 추가로 필요할 수 있어요. 코드를 먼저 요청한 뒤 변경을 진행해 주세요.</p><ActionForm action={requestPasswordNonce} submitLabel="추가 확인 코드 받기" >{null}</ActionForm></details></>;
}
export function SignOutForm() { return <ActionForm action={signOut} submitLabel="로그아웃">{null}</ActionForm>; }
