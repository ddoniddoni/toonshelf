import { notFound } from "next/navigation";
import { guardPage } from "@/lib/auth/session";
import { uuidSchema } from "@/lib/catalogue/model";
import { getTierEditor } from "@/lib/tiers/data";
import { ConnectionNotice } from "@/components/auth/auth-shell";
import { TierDraftEditor } from "@/components/tiers/draft-editor";
export const metadata={title:"티어표 편집",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const account=await guardPage(`/tiers/${id}/edit`);if (!account) return <section className="page-container tier-list-page"><h1>티어표 편집</h1><ConnectionNotice/></section>;
 const editor=await getTierEditor(id);if (!editor) notFound();return <TierDraftEditor key={id} initial={editor}/>;
}
