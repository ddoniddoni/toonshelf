import { notFound } from "next/navigation";
import { shareTokenSchema } from "@/lib/tiers/publication-model";
import { getTierPublication } from "@/lib/tiers/publication-data";
import { PublicationDetail } from "@/components/tiers/publication-detail";
import { tierImageMetadata } from "@/lib/tiers/image-metadata";
export const dynamic="force-dynamic";
// One generic image URL; no token, tier ID, canonical URL or body in metadata.
export function generateMetadata() {return tierImageMetadata(null);}
export default async function Page({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;if (!shareTokenSchema.safeParse(token).success) notFound();
 const publication=await getTierPublication(null,token);if (!publication) notFound();return <PublicationDetail publication={publication} token={token}/>;
}
