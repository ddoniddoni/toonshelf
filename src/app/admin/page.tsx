import Link from "next/link";
import { AdminShell } from "@/components/catalogue/admin-shell";
import { guardAdminPage } from "@/lib/catalogue/admin";
export const metadata = {title:"카탈로그 관리",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await guardAdminPage("/admin");
  return <AdminShell title="작품 정보를, 정확하게." description="출처를 확인하고 작품을 등록해요. 공개 범위와 이미지 권리는 따로 확인해요." connected={Boolean(account)}>
    <div className="admin-start-grid"><Link href="/admin/works/new"><h2>작품 등록</h2><p>한 작품에 여러 공식 읽는 곳을 연결해요.</p></Link><Link href="/admin/submissions"><h2>제보 검수</h2><p>제보를 검토하고 반영 결과를 남겨요.</p></Link><Link href="/admin/assets"><h2>표지 권리</h2><p>표시·공유·내보내기 허가를 구분해요.</p></Link></div>
  </AdminShell>;
}
