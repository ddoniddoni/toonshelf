import { AdminShell } from "@/components/catalogue/admin-shell";
import { WorkForm } from "@/components/catalogue/work-form";
import { guardAdminPage } from "@/lib/catalogue/admin";
import { catalogueOptions } from "@/lib/catalogue/data";
import { catalogueError } from "@/lib/catalogue/errors";
export const metadata = {title:"작품 등록",robots:{index:false,follow:false}};
export const dynamic = "force-dynamic";
export default async function Page() {
  const account = await guardAdminPage("/admin/works/new");
  const options = account ? await catalogueOptions() : null;
  const creators = account ? await account.client.from("toon_creators").select("*").order("name").limit(200) : null;
  if(creators)catalogueError(creators.error);
  return <AdminShell title="새 작품 등록" description="출처와 연령 등급을 확인하고 직접 소개를 작성해 주세요." connected={Boolean(account)}>
    {options ? <><p className="field-hint">등록 전 작품 목록의 중복 확인을 먼저 사용해 주세요. 이름만 같은 작가·원작·새 각색을 자동으로 합치지 않아요.</p><WorkForm snapshot={null} platforms={options.platforms} genres={options.genres} knownCreators={creators?.data ?? []}/></> : null}
  </AdminShell>;
}
