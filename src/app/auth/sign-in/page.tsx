import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";
import { getServerEnv } from "@/lib/env/server";
import { safeReturnTo } from "@/lib/auth/validation";
import { registrationOpen } from "@/lib/auth/config";
export const metadata = {title:"로그인"};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params = await searchParams; const env = getServerEnv();
  return <AuthShell title="다시, 나의 서재로." description="읽던 이야기와 남겨 둔 취향을 이어가세요."><SignInForm returnTo={safeReturnTo(params.returnTo)} error={params.error === "oauth"} google={env.AUTH_GOOGLE_ENABLED && registrationOpen()} kakao={env.AUTH_KAKAO_ENABLED && registrationOpen()}/></AuthShell>;
}
