import { z } from "zod";
import { AdminShell } from "@/components/catalogue/admin-shell";
import { guardAdminPage } from "@/lib/catalogue/admin";
import { catalogueError } from "@/lib/catalogue/errors";
const logSchema = z.array(z.object({id:z.string(),action:z.string(),reason:z.string(),created_at:z.string(),target_id:z.string().nullable()}));
export const metadata = {title:"카탈로그 관리 이력",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await guardAdminPage("/admin/audit");
  const result = account ? await account.client.rpc("admin_catalogue_audit") : null;if(result)catalogueError(result.error);
  const logs = result ? logSchema.parse(result.data) : [];
  return <AdminShell title="카탈로그 관리 이력" description="최근 50개 변경의 동작·대상·사유를 확인해요. 일반 회원에게는 공개하지 않아요." connected={Boolean(account)}>
    <div className="submission-list">{logs.length ? logs.map(log=><article key={log.id}><h2>{log.action}</h2><p>{log.reason}</p><p>{log.created_at} · 대상 {log.target_id ?? "삭제됨"}</p></article>) : <p>아직 관리 이력이 없어요.</p>}</div>
  </AdminShell>;
}
