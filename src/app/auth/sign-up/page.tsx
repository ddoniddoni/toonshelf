import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";
import { registrationOpen } from "@/lib/auth/config";
export const metadata = {title:"회원가입"};
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthShell title="내 취향의 첫 장." description="이메일을 확인하고, 나만의 웹툰 서재를 시작하세요.">{registrationOpen() ? <SignUpForm/> : <p role="status">현재 신규 가입을 준비하고 있어요.</p>}</AuthShell>;
}
