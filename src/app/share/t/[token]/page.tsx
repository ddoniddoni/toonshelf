import { notFound } from "next/navigation";
import { shareTokenSchema } from "@/lib/tiers/publication-model";
import { getTierPublication } from "@/lib/tiers/publication-data";
import { PublicationDetail } from "@/components/tiers/publication-detail";
export const dynamic="force-dynamic";
// No token, canonical URL, author title, spoiler body or image in metadata.
export const metadata={title:"공유 티어표",description:"링크로 공유된 티어표예요.",robots:{index:false,follow:false},referrer:"no-referrer" as const,openGraph:{title:"ToonShelf · 공유 티어표",description:"링크로 공유된 티어표"}};
export default async function Page({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;if (!shareTokenSchema.safeParse(token).success) notFound();
 const publication=await getTierPublication(null,token);if (!publication) notFound();return <PublicationDetail publication={publication} token={token}/>;
}
