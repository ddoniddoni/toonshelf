import Link from "next/link";
import { ReviewText } from "@/components/reviews/plain-text";
import { WorkCard } from "@/components/catalogue/work-card";
import type { WorkCard as Work } from "@/lib/catalogue/model";
export function PostContent({title,body,works}:{title:string;body:string;works:Work[]}) {
 return <><h2 className="post-content-title">{title}</h2><ReviewText body={body}/>{works.length ? <section aria-label="연결된 작품"><h2>함께 이야기하는 작품</h2><div className="post-work-grid">{works.map(work=><div key={work.id}><WorkCard work={work}/><Link className="text-link" href={`/community?work=${work.id}`} prefetch={false}>이 작품의 다른 글 →</Link></div>)}</div></section> : null}</>;
}
