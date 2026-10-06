import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
export const metadata = {title:"비밀번호 찾기"};
export default function Page() {
  return <AuthShell title="비밀번호를 잊었나요?" description="아이디 계정의 비밀번호 찾기는 준비 중이에요."><p>현재 가입 방식은 이메일을 등록하지 않아 복구 메일을 보낼 수 없어요. 로그인 중이라면 로그인과 보안에서 현재 비밀번호로 변경할 수 있어요.</p><Link className="text-link" href="/settings/account">로그인과 보안</Link><Link className="text-link" href="/auth/sign-in">로그인으로 돌아가기</Link></AuthShell>;
}
