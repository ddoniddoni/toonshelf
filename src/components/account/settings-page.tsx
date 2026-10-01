import { AccountShell } from "./account-shell";
import { SettingsForm } from "./account-forms";
import { guardPage } from "@/lib/auth/session";
import { getGenres, getMySettings } from "@/lib/auth/data";
export async function SettingsPage({path}: {path:string}) {
  const account = await guardPage(path);
  const [settings,genres] = account ? await Promise.all([getMySettings(),getGenres()]) : [null,[]];
  return <AccountShell title="공개 범위와 알림" description="어떤 기록을 공개하고, 어떤 소식을 받을지 정해요." connected={Boolean(account)}>{settings ? <SettingsForm settings={settings} genres={genres}/> : null}</AccountShell>;
}
