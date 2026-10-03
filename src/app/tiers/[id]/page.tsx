import { notFound } from "next/navigation";
import { uuidSchema } from "@/lib/catalogue/model";
import { getTierPublication } from "@/lib/tiers/publication-data";
import { PublicationDetail } from "@/components/tiers/publication-detail";
import { tierImageMetadata } from "@/lib/tiers/image-metadata";
export const dynamic="force-dynamic";
// Metadata text stays generic; its image route rechecks the current publication.
export async function generateMetadata({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;return tierImageMetadata(id);
}
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const publication=await getTierPublication(id);if (!publication) notFound();return <PublicationDetail publication={publication}/>;
}
