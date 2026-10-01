import { AuthShell } from "@/components/auth/auth-shell";
import { RecoveryForm } from "@/components/auth/auth-forms";
export const metadata = {title:"비밀번호 찾기"};
export default function Page() { return <AuthShell title="서재로 돌아가는 길." description="가입한 이메일로 비밀번호 복구 안내를 보내드릴게요."><RecoveryForm/></AuthShell>; }
