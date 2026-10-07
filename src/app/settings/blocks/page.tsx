import { guardPage } from "@/lib/auth/session";
import { getMyBlocks } from "@/lib/reviews/data";
import { AccountShell } from "@/components/account/account-shell";
import { BlockForm } from "@/components/reviews/forms";
export const dynamic = "force-dynamic";
export const metadata = {title:"차단한 사용자",robots:{index:false,follow:false}};
export default async function Page() {
 const account = await guardPage("/settings/blocks");const blocks = account ? await getMyBlocks() : [];
 return <AccountShell title="차단한 사용자" description="내가 차단한 목록만 보여요. 서로의 리뷰·프로필·공개 기록 노출을 제한하고 양쪽 팔로우를 해제해요. 차단을 해제해도 이전 팔로우는 복원되지 않아요." connected={Boolean(account)}><div className="review-list">{blocks.map(b=><article className="review-card" key={b.id}><h2>{b.name}</h2><p>{b.username ? "@"+b.username : ""}</p><BlockForm userId={b.id} blocked name={b.name}/></article>)}{!blocks.length ? <p>차단한 사용자가 없어요.</p> : null}</div></AccountShell>;
}
