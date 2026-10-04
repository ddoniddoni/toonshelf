import Link from "next/link";
import type { TierDiscoveryFilters } from "@/lib/tiers/discovery-model";

export function TierDiscoveryFilterForm({filters,disabled=false}:{filters:TierDiscoveryFilters;disabled?:boolean}) {
 return <form key={JSON.stringify(filters)} action="/tiers" method="get" className="library-filters tier-discovery-filters" aria-label="공개 티어표 탐색 조건">
  <fieldset className="library-filter-toolbar" disabled={disabled}>
   <legend className="sr-only">정렬과 테마 태그</legend>
   <label>정렬<select name="sort" defaultValue={filters.sort}><option value="latest">최신 게시순</option><option value="popular">최근 7일 좋아요순</option></select></label>
   <label className="library-filter-search">테마 태그<input name="tag" defaultValue={filters.tag ?? ""} maxLength={40} placeholder="게시된 태그를 정확히 입력" aria-describedby="tier-tag-hint"/></label>
   <button className="button button-primary" type="submit">조건 적용</button>
   <Link className="text-link" href="/tiers" prefetch={false}>조건 초기화</Link>
  </fieldset>
  <p id="tier-tag-hint" className="field-hint">태그는 1~20자이며 대소문자와 공백을 구분해요. 스포일러 표는 숨겨진 태그로 검색되지 않아요.</p>
  <p className="field-hint">최근 7일 좋아요순은 지금 유효한 최근 반응으로 정렬해요. 같은 수일 때는 최신 게시순이며 차단 설정에 따라 수와 순서가 달라질 수 있어요.</p>
 </form>;
}
