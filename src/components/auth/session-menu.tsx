import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import { getMyProfile, getMySettings } from "@/lib/auth/data";
import { AccountTheme } from "@/components/account/account-theme";
import { UserAvatar } from "@/components/account/user-avatar";
import { UserRound } from "lucide-react";
async function loadMenu(): Promise<{href:string;label:string;avatar?:string|null;theme?:"system"|"light"|"dark";admin?:boolean}> {
  try {
    const account = await getCurrentAccount();
    if (!account) return {href:"/auth/sign-in",label:"로그인"};
    if (account.access.status !== "active" || !account.access.consents_current || !account.user.email_confirmed_at) return {href:"/settings/profile",label:"내 계정"};
    const [profile,settings,role] = await Promise.all([getMyProfile(),getMySettings(),account.client.rpc("get_my_catalogue_role")]);
    return {href:"/settings/profile",label:profile?.display_name || "내 프로필",avatar:profile?.avatar_path ?? null,theme:settings?.theme,admin:role.data === true};
  } catch { return {href:"/auth/sign-in",label:"계정 연결 확인"}; }
}
export async function SessionMenu() {
  const menu = await loadMenu();
  return <>{menu.theme ? <AccountTheme theme={menu.theme}/> : null}{menu.admin ? <Link className="text-link" href="/admin">관리</Link> : null}<Link className="header-profile" href={menu.href}>{menu.avatar !== undefined ? <UserAvatar path={menu.avatar} name={menu.label}/> : <span className="header-profile-icon"><UserRound size={17} aria-hidden="true"/></span>}<span>{menu.label}</span></Link></>;
}
