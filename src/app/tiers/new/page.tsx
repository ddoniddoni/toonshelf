import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { ConnectionNotice } from "@/components/auth/auth-shell";
import { NewTierForm } from "@/components/tiers/draft-forms";
export const metadata={title:"새 티어표",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function Page() {
 const account=await guardPage("/tiers/new");
 return <section className="page-container tier-list-page"><Link className="text-link" href="/me/tiers">← 내 티어표</Link><h1>새 티어표 만들기</h1><p>내 취향대로 배치하고 비공개 초안으로 저장해 보세요.</p>{account ? <NewTierForm/> : <ConnectionNotice/>}</section>;
}
