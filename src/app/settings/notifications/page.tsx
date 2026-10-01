import { SettingsPage } from "@/components/account/settings-page";
export const metadata = {title:"알림 설정"};
export const dynamic = "force-dynamic";
export default function Page() { return <SettingsPage path="/settings/notifications"/>; }
