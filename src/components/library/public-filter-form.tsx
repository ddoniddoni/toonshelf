import Link from "next/link";
import { readingLabels,type PublicLibraryFilters } from "@/lib/library/model";

type Options = {platforms:{id:string;code:string;name:string}[];genres:{id:string;slug:string;name:string}[]};
export function PublicLibraryFilterForm({username,filters,options}:{username:string;filters:PublicLibraryFilters;options:Options|null}) {
 const path = "/u/"+encodeURIComponent(username)+"/library";
 return <form key={JSON.stringify(filters)} action={path} method="get" className="library-filters public-library-filters" aria-label="공개 서재 검색 조건">
  <div className="library-filter-toolbar"><label className="library-filter-search">작품 제목·별칭·작가 검색<input name="q" defaultValue={filters.q} maxLength={200} placeholder="공개 작품 검색"/></label>
   <label>읽기 상태<select name="status" defaultValue={filters.status ?? ""}><option value="">상태 전체</option>{Object.entries(readingLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>플랫폼<select name="platform" defaultValue={filters.platform ?? ""}><option value="">플랫폼 전체</option>{options?.platforms.map(p=><option key={p.id} value={p.code}>{p.name}</option>)}</select></label>
   <label>장르<select name="genre" defaultValue={filters.genre ?? ""}><option value="">장르 전체</option>{options?.genres.map(g=><option key={g.id} value={g.slug}>{g.name}</option>)}</select></label>
  </div><div className="library-filter-toolbar">
   <label>공개 별점<select name="rating" defaultValue={filters.rating ?? ""}><option value="">별점 전체</option>{Array.from({length:10},(_,index)=><option key={index+1} value={index+1}>{((index+1)/2).toFixed(1)}점</option>)}</select></label>
   <label>공개 기본 티어<select name="tier" defaultValue={filters.tier ?? ""}><option value="">티어 전체</option>{["S","A","B","C","D","F"].map(tier=><option key={tier} value={tier}>{tier}</option>)}</select></label>
   <label>정렬<select name="sort" defaultValue={filters.sort}><option value="title">제목순</option><option value="rating">공개 별점 높은 순</option><option value="tier">공개 티어 높은 순</option></select></label>
   <button className="button button-primary">검색 조건 적용</button><Link className="text-link" href={path}>조건 초기화</Link>
  </div><p className="field-hint">상태·별점·티어 조건은 공개한 항목에만 적용돼요. 별점 조건은 선택한 점수와 같은 평가를 찾아요.</p>
 </form>;
}
