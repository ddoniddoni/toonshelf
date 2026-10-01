"use client";
import { ActionForm,Checkbox,Field,Textarea } from "@/components/forms/action-form";
import { revokeCover,uploadCover } from "@/lib/catalogue/cover-actions";
export function UploadCoverForm({works,selected}:{works:{id:string;title:string}[];selected?:string}) {
  return <ActionForm action={uploadCover} submitLabel="권리 기록과 표지 등록">
    <label>대상 작품<select name="workId" required defaultValue={selected ?? works[0]?.id ?? ""}>{works.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select></label>
    <Field name="cover" type="file" accept="image/jpeg,image/png,image/webp" label="허가받은 표지 파일" required hint="정지 JPEG·PNG·WebP, 2MB 이하. 서버에서 메타데이터를 제거하고 재인코딩해요."/>
    <Field name="rightsHolder" label="권리자" required maxLength={400}/>
    <Textarea name="evidence" label="허가 근거 · 관리자에게만 공개" maxLength={4000}/>
    <Textarea name="attribution" label="화면에 표시할 권리자 표기" maxLength={1000}/>
    <div className="admin-form-grid"><Field name="validFrom" type="date" label="허가 시작일 (UTC)" defaultValue={new Date().toISOString().slice(0,10)} required/><Field name="expiresAt" type="date" label="허가 만료일 (UTC) · 선택"/></div>
    <fieldset><legend>확인된 사용 범위</legend><Checkbox name="display" label="화면 표시 허용"/><Checkbox name="og" label="OG 공유 이미지 재배포 허용"/><Checkbox name="export" label="PNG 내보내기 재배포 허용"/><Checkbox name="commercial" label="상업적 이용 허용"/></fieldset>
    <Textarea name="reason" label="등록 사유" maxLength={1000}/>
    <p className="field-hint">각 허가는 독립적이에요. 표시 허가만으로 OG·PNG 재배포를 허용하지 않아요. 외부 주소에서 이미지를 가져오지 않아요.</p>
  </ActionForm>;
}
export function RevokeCoverForm({assetId}:{assetId:string}) {
  return <ActionForm action={revokeCover} submitLabel="모든 사용 허가 철회"><input type="hidden" name="assetId" value={assetId}/><Textarea name="reason" label="철회 사유" maxLength={1000}/></ActionForm>;
}
