import { ComingSoon } from "@/components/coming-soon";
import { guardPage } from "@/lib/auth/session";

export const metadata = { title: "내 서재" };
export const dynamic = "force-dynamic";
export default async function Page() {
  await guardPage("/me/library");
  return <ComingSoon eyebrow="내 서재" title="좋아하는 이야기의 자리" description="개인 서재의 작품 기록 기능을 준비하고 있어요. 기록을 저장할 수 있게 되면 비공개 서재에서 시작할 수 있어요." />;
}
