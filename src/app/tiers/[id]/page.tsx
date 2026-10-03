import { notFound } from "next/navigation";
import { uuidSchema } from "@/lib/catalogue/model";
import { getTierPublication } from "@/lib/tiers/publication-data";
import { PublicationDetail } from "@/components/tiers/publication-detail";
export const dynamic="force-dynamic";
// Generic metadata never embeds tier titles, row labels, placement or old bodies.
export const metadata={title:"공개 티어표",description:"웹툰 취향을 담은 공개 티어표예요. 스포일러 내용은 직접 펼친 뒤 확인할 수 있어요.",robots:{index:false,follow:false},openGraph:{title:"ToonShelf · 공개 티어표",description:"취향을 담은 웹툰 티어표"}};
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if (!uuidSchema.safeParse(id).success) notFound();
 const publication=await getTierPublication(id);if (!publication) notFound();return <PublicationDetail publication={publication}/>;
}
