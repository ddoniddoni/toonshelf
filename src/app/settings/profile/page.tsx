import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import { AvatarForm, ProfileForm } from "@/components/account/account-forms";
import { UserAvatar } from "@/components/account/user-avatar";
import { guardPage } from "@/lib/auth/session";
import { getMyProfile } from "@/lib/auth/data";
export const metadata = {title:"내 프로필"};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await guardPage("/settings/profile"); const profile = account ? await getMyProfile() : null;
  return <AccountShell title="나를 소개하는 작은 공간" description="닉네임과 소개는 공개 프로필에 표시돼요." connected={Boolean(account)}>{profile ? <><div className="profile-summary"><UserAvatar path={profile.avatar_path} name={profile.display_name}/><div><strong>{profile.display_name}</strong><Link className="text-link" href={`/u/${profile.username}`}>공개 프로필 보기</Link></div></div><ProfileForm profile={profile}/><details className="account-details"><summary>프로필 사진 변경</summary><AvatarForm/></details></> : null}</AccountShell>;
}
