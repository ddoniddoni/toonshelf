import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import { getMyProfile, getMySettings } from "@/lib/auth/data";
import { AccountTheme } from "@/components/account/account-theme";
async function loadMenu(): Promise<{href:string;label:string;theme?:"system"|"light"|"dark";admin?:boolean}> {
  try {
    const account = await getCurrentAccount();
    if (!account) return {href:"/auth/sign-in",label:"로그인"};
    if (account.access.status !== "active" || !account.access.consents_current || !account.user.email_confirmed_at) return {href:"/settings/profile",label:"내 계정"};
    const [profile,settings,role] = await Promise.all([getMyProfile(),getMySettings(),account.client.rpc("get_my_catalogue_role")]);
    return {href:"/settings/profile",label:profile?.display_name || "내 프로필",theme:settings?.theme,admin:role.data === true};
  } catch { return {href:"/auth/sign-in",label:"계정 연결 확인"}; }
}
export async function SessionMenu() {
  const menu = await loadMenu();
  return <>{menu.theme ? <AccountTheme theme={menu.theme}/> : null}{menu.admin ? <Link className="text-link" href="/admin">관리</Link> : null}<Link className="button button-small button-secondary" href={menu.href}>{menu.label}</Link></>;
}
