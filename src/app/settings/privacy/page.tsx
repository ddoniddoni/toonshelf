import { SettingsPage } from "@/components/account/settings-page";
export const metadata = {title:"공개 범위와 알림"};
export const dynamic = "force-dynamic";
export default function Page() { return <SettingsPage path="/settings/privacy"/>; }
