import { notFound } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { getPublicEnv } from "@/lib/env/public";
import { uuidSchema } from "@/lib/catalogue/model";
import { getPublicationPreview } from "@/lib/tiers/publication-data";
import { PublicationPanel } from "@/components/tiers/publication-panel";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export const dynamic="force-dynamic";
export const metadata={title:"티어표 게시·공유",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const account=await guardPage(`/tiers/${id}/publish`);if (!account) return <section className="page-container tier-list-page"><h1>티어표 게시·공유</h1><ConnectionNotice/></section>;
 const preview=await getPublicationPreview(id);if (!preview) notFound();
 return <section className="page-container tier-list-page"><p className="eyebrow">PUBLISH YOUR TASTE</p><h1>티어표 게시·공유</h1><PublicationPanel key={`${preview.state.version}:${preview.draftVersion}:${preview.fingerprint}`} preview={preview} siteUrl={getPublicEnv().siteUrl}/></section>;
}
