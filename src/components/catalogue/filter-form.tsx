import Link from "next/link";
import type { CatalogueFilters,Platform } from "@/lib/catalogue/model";
import { ageLabels,dayLabels,serialLabels } from "@/lib/catalogue/model";
import { SearchBox } from "./search-box";
export function FilterForm({filters,options,disabled=false}:{filters:CatalogueFilters;options:{platforms:Platform[];genres:{id:string;slug:string;name:string}[]}|null;disabled?:boolean}) {
  return <form action="/explore" method="get" className="catalogue-filters">
    <div className="catalogue-search-row"><SearchBox key={JSON.stringify(filters)} initial={filters.q} filters={filters} disabled={disabled}/><button className="button button-primary" disabled={disabled}>검색</button></div>
    <details className="filter-details" open><summary>플랫폼과 장르 · 필터</summary><fieldset disabled={disabled}><legend className="sr-only">작품 검색 조건</legend>
      <div className="filter-columns"><fieldset><legend>플랫폼</legend><div className="filter-choices">{options?.platforms.map(p=><label key={p.id}><input type="checkbox" name="platform" value={p.code} defaultChecked={filters.platform.includes(p.code)}/>{p.name}</label>)}</div></fieldset>
        <fieldset><legend>장르</legend><div className="filter-choices">{options?.genres.map(g=><label key={g.id}><input type="checkbox" name="genre" value={g.slug} defaultChecked={filters.genre.includes(g.slug)}/>{g.name}</label>)}</div></fieldset></div>
      <div className="filter-selects"><label>연재 상태<select name="status" defaultValue={filters.status ?? ""}><option value="">모든 상태</option>{Object.entries(serialLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>연령 범주<select name="age" defaultValue={filters.age ?? ""}><option value="">확인된 비성인 작품</option>{(["all","12","15"] as const).map(v=><option key={v} value={v}>{ageLabels[v]}</option>)}</select></label>
        <label>정렬<select name="sort" defaultValue={filters.sort}><option value="latest">최근 등록순</option><option value="title">제목순</option><option value="rating" disabled>평점순 · 평가 기능 준비 중</option></select></label></div>
      <fieldset><legend>연재 요일</legend><div className="filter-choices">{dayLabels.map((label,index)=><label key={label}><input type="checkbox" name="day" value={index} defaultChecked={filters.day.includes(index)}/>{label}</label>)}</div></fieldset>
    </fieldset></details>
    <div className="filter-footer"><p>제목·별칭·작가명에 포함된 글자를 찾아요. 선택한 플랫폼과 요일은 같은 공식 링크에 적용돼요.</p><Link className="text-link" href="/explore">필터 초기화</Link></div>
  </form>;
}
