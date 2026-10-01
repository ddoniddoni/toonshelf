"use client";

import { useState } from "react";
import { ActionForm,Checkbox,Field,Select,Textarea } from "@/components/forms/action-form";
import { upsertWork } from "@/lib/catalogue/actions";
import { ageLabels,dayLabels,roleLabels,serialLabels,type Platform,type WorkPayload } from "@/lib/catalogue/model";
import type { AdminSnapshot } from "@/lib/catalogue/admin";
import type { CreatorRow } from "@/types/database.contract";
const today = () => new Date().toISOString().slice(0,10);
const newCreator = ():WorkPayload["creators"][number] => ({id:null,name:"",aliases:[],role:"writer",order:0});
const newLink = (platformId:string):WorkPayload["links"][number] => ({platformId,url:"",externalId:null,weekdays:[],serialStatus:"unknown",ageRating:"unknown",verifiedAt:today()+"T00:00:00Z",active:true});
export function WorkForm({snapshot,platforms,genres,knownCreators}:{snapshot:AdminSnapshot|null;platforms:Platform[];genres:{id:string;name:string}[];knownCreators:CreatorRow[]}) {
  const work = snapshot?.work;
  const [creators,setCreators] = useState(()=>snapshot?.creators ?? [newCreator()]);
  const [links,setLinks] = useState(()=>snapshot?.links.length ? snapshot.links : [newLink(platforms[0]?.id ?? "")]);
  const source = snapshot?.sources[0];
  return <ActionForm action={upsertWork} submitLabel={work ? "작품 정보 저장" : "작품 등록"}>
    <input type="hidden" name="id" value={work?.id ?? ""}/><input type="hidden" name="version" value={work?.version ?? ""}/>
    <section className="admin-form-section"><h2>작품 기본 정보</h2><div className="admin-form-grid">
      <Field name="title" label="작품 제목" required maxLength={400} defaultValue={work?.title}/>
      <Field name="slug" label="작품 주소 이름" required maxLength={80} defaultValue={work?.slug} readOnly={Boolean(work)} hint="영문 소문자·숫자·하이픈 3~80자. 등록 후에는 유지해요."/>
      <Select name="serialStatus" label="작품 연재 상태" defaultValue={work?.serial_status ?? "unknown"}>{Object.entries(serialLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
      <Select name="ageRating" label="확인된 작품 연령 등급" defaultValue={work?.age_rating ?? "unknown"}>{Object.entries(ageLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>
      <Select name="catalogueStatus" label="카탈로그 상태" defaultValue={work?.catalogue_status ?? "draft"}><option value="draft">검수 중 · 비공개</option><option value="published" disabled={work?.is_test}>공개</option><option value="hidden">숨김</option></Select>
    </div>
      <Textarea name="aliases" label="작품 별칭 · 한 줄에 하나" maxLength={8000} defaultValue={work?.aliases.join("\n")}/>
      <Textarea name="description" label="직접 작성한 작품 소개" maxLength={4000} defaultValue={work?.original_description}/>
      <Checkbox name="originalDescription" label="소개문을 직접 작성했으며 외부 플랫폼의 문구를 복사하지 않았어요." required/>
      <fieldset><legend>장르</legend><div className="filter-choices">{genres.map(g=><label key={g.id}><input type="checkbox" name="genreIds" value={g.id} defaultChecked={snapshot?.genreIds.includes(g.id)}/>{g.name}</label>)}</div></fieldset>
    </section>
    <section className="admin-form-section"><h2>작가와 역할</h2><p className="field-hint">같은 이름만으로 동일 인물로 합치지 않아요. 기존 작가를 선택하거나 새 작가로 등록하세요.</p>
      <input type="hidden" name="creatorCount" value={creators.length}/>
      {creators.map((creator,index)=>{const prefix = "creator."+index+".";
        return <fieldset className="admin-repeat-row" key={index}><legend>작가 {index+1}</legend><label>작가 선택<select value={creator.id ?? ""} onChange={event=>{
          const selected = knownCreators.find(c=>c.id === event.target.value);
          setCreators(previous=>previous.map((c,i)=>i === index ? {...(selected ? selected : newCreator()),role:c.role,order:index} : c));
        }}><option value="">새 작가</option>{knownCreators.map(c=><option key={c.id} value={c.id}>{c.name} · {c.id.slice(0,8)}</option>)}</select></label>
          <input type="hidden" name={prefix+"id"} value={creator.id ?? ""}/>
          <div className="admin-form-grid" key={creator.id ?? "new"}><Field name={prefix+"name"} label="작가 이름" defaultValue={creator.name} readOnly={Boolean(creator.id)} required maxLength={200}/>
            <Select name={prefix+"role"} label="역할" defaultValue={creator.role}>{Object.entries(roleLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</Select>
            <Textarea name={prefix+"aliases"} label="작가 별칭 · 한 줄에 하나" defaultValue={creator.aliases.join("\n")} readOnly={Boolean(creator.id)} maxLength={4000}/>
          </div>
        </fieldset>;})}
      <div className="admin-row-actions"><button type="button" className="button button-secondary" disabled={creators.length >= 20} onClick={()=>setCreators(previous=>[...previous,newCreator()])}>작가 추가</button><button type="button" className="text-link" disabled={!creators.length} onClick={()=>setCreators(previous=>previous.slice(0,-1))}>마지막 작가 제외</button></div>
    </section>
    <section className="admin-form-section"><h2>공식 플랫폼 링크</h2><p className="field-hint">같은 웹툰의 여러 유통처를 연결해요. 외부 주소를 자동 수집하거나 접속하지 않아요. 제외한 링크는 비활성화되어 기존 식별자를 보존해요.</p>
      <input type="hidden" name="linkCount" value={links.length}/>
      {links.map((link,index)=>{const prefix = "link."+index+".";
        return <fieldset className="admin-repeat-row" key={index}><legend>공식 링크 {index+1}</legend><div className="admin-form-grid">
          <Select name={prefix+"platformId"} label="플랫폼" defaultValue={link.platformId}>{platforms.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <Field name={prefix+"url"} type="url" label="공식 작품 페이지 (HTTPS)" required maxLength={2048} defaultValue={link.url}/>
          <Field name={prefix+"externalId"} label="플랫폼 작품 식별자 · 선택" defaultValue={link.externalId ?? ""} maxLength={100}/>
          <Select name={prefix+"serialStatus"} label="플랫폼 연재 상태" defaultValue={link.serialStatus}>{Object.entries(serialLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</Select>
          <Select name={prefix+"ageRating"} label="플랫폼 연령 등급" defaultValue={link.ageRating}>{Object.entries(ageLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</Select>
          <Field name={prefix+"verifiedAt"} type="date" label="정보 확인일 (UTC)" required defaultValue={link.verifiedAt.slice(0,10)}/>
        </div><div className="filter-choices">{dayLabels.map((d,i)=><label key={d}><input type="checkbox" name={prefix+"weekdays"} value={i} defaultChecked={link.weekdays.includes(i)}/>{d}</label>)}</div><Checkbox name={prefix+"active"} label="유효한 공식 링크" defaultChecked={link.active}/>
        </fieldset>;})}
      <div className="admin-row-actions"><button type="button" className="button button-secondary" disabled={links.length >= 20} onClick={()=>setLinks(previous=>[...previous,newLink(platforms[0]?.id ?? "")])}>공식 링크 추가</button><button type="button" className="text-link" disabled={links.length <= 1} onClick={()=>setLinks(previous=>previous.slice(0,-1))}>마지막 링크 제외</button></div>
    </section>
    <section className="admin-form-section"><h2>정보 출처와 변경 사유</h2>
      <Field name="sourceUrl" label="확인한 출처 주소" type="url" required maxLength={2048} defaultValue={source?.source_url}/>
      <Field name="sourceVerifiedAt" label="출처 확인일 (UTC)" type="date" required defaultValue={today()}/>
      <fieldset><legend>확인한 항목</legend><div className="filter-choices">{[["title","제목"],["ageRating","연령 등급"],["links","공식 링크"],["aliases","별칭"],["creators","작가"],["genres","장르"],["serialStatus","연재 상태"],["description","소개"]].map(([v,label])=><label key={v}><input type="checkbox" name="sourceFields" value={v} defaultChecked={["title","ageRating","links"].includes(v)} required={["title","ageRating","links"].includes(v)}/>{label}</label>)}</div></fieldset>
      <Textarea name="sourceNote" label="관리자 확인 메모 · 비공개" maxLength={4000}/>
      <Textarea name="reason" label="이번 등록·수정 사유" maxLength={1000}/>
    </section>
  </ActionForm>;
}
