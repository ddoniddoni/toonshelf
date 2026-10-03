import "server-only";
import type { Metadata } from "next";
import { getPublicEnv } from "@/lib/env/public";
import { uuidSchema } from "@/lib/catalogue/model";

export function tierImageMetadata(id:string|null):Metadata {
  const linked=id === null;
  const title=linked ? "공유 티어표" : "공개 티어표",description=linked ? "링크로 공유된 티어표예요." : "웹툰 취향을 담은 공개 티어표예요. 스포일러는 직접 펼친 뒤 확인할 수 있어요.";
  const path=id !== null && uuidSchema.safeParse(id).success ? `/api/og/tiers/${id}` : "/api/og/tiers";
  const image={url:new URL(path,getPublicEnv().siteUrl).href,width:1200,height:630,alt:"ToonShelf 티어표 공유 카드"};
  return {title,description,robots:{index:false,follow:false},referrer:"no-referrer",
    openGraph:{title:"ToonShelf · "+title,description,images:[image]},
    twitter:{card:"summary_large_image",title:"ToonShelf · "+title,description,images:[image.url]},
  };
}
