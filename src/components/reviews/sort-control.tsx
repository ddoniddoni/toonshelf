import Link from "next/link";
import { reviewSortLabels,type ReviewSort } from "@/lib/reviews/model";
export function reviewListUrl(base:string,sort:ReviewSort,page=1) {
 const params=new URLSearchParams({sort});if(page>1)params.set("page",String(page));return `${base}?${params}`;
}
export function ReviewSortControl({base,sort,available}:{base:string;sort:ReviewSort;available:boolean}) {
 return <><nav className="library-pagination" aria-label="리뷰 정렬">{(Object.keys(reviewSortLabels) as ReviewSort[]).map(value=><Link key={value} className="text-link" href={reviewListUrl(base,value)} aria-current={sort===value ? "page" : undefined} prefetch={false}>{reviewSortLabels[value]}</Link>)}</nav>
  {!available ? <p role="status">좋아요와 인기순 집계를 준비하고 있어요. 현재 목록은 최초 게시일 최신순으로 보여드려요.</p> : <p className="field-hint">최신순은 최초 게시일 기준이에요. 최근 7일 인기는 유효 좋아요와 서로 다른 댓글 참여자 수를 반영해요. 숨김·공개 취소·차단한 사용자의 반응은 제외돼요.</p>}
 </>;
}
