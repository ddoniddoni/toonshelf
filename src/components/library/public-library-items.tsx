import { WorkCard } from "@/components/catalogue/work-card";
import { CopyToLibrary } from "./record-form";
import { readingLabels,type PublicLibrary } from "@/lib/library/model";

export function PublicLibraryItems({items}:{items:PublicLibrary["items"]}) {
 return <div className="public-library-grid">{items.map(item=><article className="public-library-item" key={item.work.id}>
  <WorkCard work={item.work}/><p>{item.status ? readingLabels[item.status] : "읽기 상태 비공개"} · {item.ratingSteps === null ? "공개 별점 없음" : (item.ratingSteps/2).toFixed(1)+"점"} · {item.canonicalTier ? "티어 "+item.canonicalTier : "공개 티어 없음"}</p>
  <CopyToLibrary workId={item.work.id}/>
 </article>)}</div>;
}
