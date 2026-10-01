import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/account/account-forms";
import { guardPage } from "@/lib/auth/session";
import { getGenres, getMyProfile } from "@/lib/auth/data";
import { safeReturnTo } from "@/lib/auth/validation";
export const metadata = {title:"나의 서재 시작"};
export const dynamic = "force-dynamic";
export default async function Page({searchParams}: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const [params,account] = await Promise.all([searchParams,guardPage("/onboarding",true)]);
  const [genres,profile] = account ? await Promise.all([getGenres(),getMyProfile(true)]) : [[],null];
  return <AuthShell title="어떤 이야기의 독자인가요?" description="나를 소개하고, 기록의 기본 공개 범위를 정해 주세요."><OnboardingForm genres={genres} profile={profile} returnTo={safeReturnTo(params.returnTo)}/></AuthShell>;
}
