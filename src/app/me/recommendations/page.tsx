import Link from "next/link";
import { guardPage } from "@/lib/auth/session";
import { AuthFailure } from "@/lib/auth/errors";
import { getPersonalRecommendations } from "@/lib/discovery/personal-data";
import { PersonalRecommendationList } from "@/components/discovery/personal-recommendations";
import { ConnectionNotice } from "@/components/auth/auth-shell";

export const dynamic="force-dynamic";
export const metadata={title:"나를 위한 작품 추천",robots:{index:false,follow:false}};
export default async function Page() {
 const account=await guardPage("/me/recommendations");
 if(!account)return <section className="page-container review-detail"><h1>나를 위한 작품 추천</h1><ConnectionNotice/></section>;
 let result;
 try {result=await getPersonalRecommendations();}catch(error) {
  if(error instanceof AuthFailure && ["CONFIG_REQUIRED","CONFLICT","INTERNAL_ERROR"].includes(error.code))
   return <section className="page-container review-detail"><h1>나를 위한 작품 추천</h1><p role="status">{error.message}</p><Link href="/me/recommendations" prefetch={false}>다시 불러오기</Link></section>;
  throw error;
 }
 return <section className="page-container personal-recommendations-page">
  <div className="hub-section-heading"><div><p className="eyebrow">FOR YOU</p><h1>나를 위한 작품 추천</h1><p>내 서재의 다음 한 편을 찾아보세요.</p></div><Link className="button button-secondary" href="/me/library" prefetch={false}>내 서재</Link></div>
  <PersonalRecommendationList result={result}/>
 </section>;
}
