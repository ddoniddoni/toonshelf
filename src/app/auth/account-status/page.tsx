import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutForm } from "@/components/auth/auth-forms";
export const metadata = {title:"계정 상태"};
export const dynamic = "force-dynamic";
export default function Page() { return <AuthShell title="계정 상태를 확인해요." description="현재 계정은 이용이 제한되었거나 삭제가 진행 중이에요."><p>지금은 기록을 조회하거나 수정할 수 없어요.</p><SignOutForm/></AuthShell>; }
