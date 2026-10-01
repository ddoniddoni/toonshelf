"use client";

import { ActionForm, Checkbox, Field, Select, Textarea } from "@/components/forms/action-form";
import { Consents } from "@/components/auth/auth-forms";
import { changeEmail, completeOnboarding, reauthenticate, saveProfile, saveSettings, sendReauthOtp } from "@/lib/auth/actions";
import { uploadAvatar, removeAvatar } from "@/lib/auth/avatar-actions";
import type { Genre, Profile, UserSettings } from "@/types/database.contract";

function VisibilityFields({library="private",evaluation="private"}: {library?:string;evaluation?:string}) {
  return <div className="form-columns"><Select name="library" label="새 서재 기록의 기본 공개 범위" defaultValue={library}><option value="private">나만 보기</option><option value="public">공개</option></Select><Select name="evaluation" label="새 평가의 기본 공개 범위" defaultValue={evaluation}><option value="private">나만 보기</option><option value="public">공개</option></Select></div>;
}
// Genre checkboxes need the DB UUID, never labels or arbitrary indexes.
function Genres({genres,selected=[]}: {genres:Genre[];selected?:string[]}) {
  const selectedIds = new Set(selected);
  return <fieldset className="genre-options"><legend>관심 장르 (선택)</legend><div>{genres.map((genre)=><label className="form-checkbox" key={genre.id}><input type="checkbox" name="genres" value={genre.id} defaultChecked={selectedIds.has(genre.id)}/><span>{genre.name}</span></label>)}</div></fieldset>;
}
export function OnboardingForm({genres,profile,returnTo}: {genres:Genre[];profile:Profile|null;returnTo:string}) {
  return <ActionForm action={completeOnboarding} submitLabel="나의 서재 시작하기"><input type="hidden" name="policyVersion" value="2026-10-02-preview"/><input type="hidden" name="returnTo" value={returnTo}/><Field name="username" label="사용자 이름" defaultValue={profile?.username ?? ""} readOnly={Boolean(profile?.username)} pattern="[a-z0-9_]{3,20}" minLength={3} maxLength={20} required autoComplete="username" hint="영문 소문자·숫자·밑줄 3~20자. 공개 프로필 주소에 쓰이며 나중에 바꿀 수 없어요."/><Field name="displayName" label="닉네임" defaultValue={profile?.display_name ?? ""} minLength={2} maxLength={60} required autoComplete="nickname"/><Textarea name="bio" label="짧은 소개 (선택)" defaultValue={profile?.bio}/><Genres genres={genres}/><VisibilityFields/><p className="field-hint">서재와 평가는 기본적으로 나만 볼 수 있어요. 두 공개 범위는 따로 선택할 수 있어요.</p><Consents/></ActionForm>;
}
export function ProfileForm({profile}: {profile:Profile}) {
  return <ActionForm action={saveProfile} submitLabel="프로필 저장"><Field name="username" label="사용자 이름" value={profile.username ?? ""} readOnly hint="사용자 이름은 변경할 수 없어요."/><Field name="displayName" label="닉네임" defaultValue={profile.display_name} minLength={2} maxLength={60} autoComplete="nickname" required/><Textarea name="bio" label="소개" defaultValue={profile.bio}/><Checkbox name="discoveryOptIn" defaultChecked={profile.discovery_opt_in} label="내 공개 평가를 바탕으로 다른 사람의 취향 탐색에 참여할게요"/><p className="field-hint">이 설정은 비공개 평가를 공개하지 않아요. 공개 평가의 일반 작품 통계는 별도로 집계돼요.</p></ActionForm>;
}
export function SettingsForm({settings,genres}: {settings:UserSettings;genres:Genre[]}) {
  const preferences = settings.notification_preferences;
  const enabled = (key:string) => Boolean(preferences && typeof preferences === "object" && !Array.isArray(preferences) && preferences[key] === true);
  return <ActionForm action={saveSettings} submitLabel="설정 저장"><VisibilityFields library={settings.default_library_visibility} evaluation={settings.default_evaluation_visibility}/><p className="field-hint">기존 기록의 공개 범위는 바뀌지 않아요.</p><Genres genres={genres} selected={settings.preferred_genre_ids}/><div className="form-columns"><Select name="theme" label="테마" defaultValue={settings.theme}><option value="system">시스템 설정</option><option value="light">라이트</option><option value="dark">다크</option></Select><Field name="timezone" label="시간대" defaultValue={settings.timezone} maxLength={100} required/></div><fieldset className="form-consents"><legend>받을 알림</legend><Checkbox name="followers" label="새 팔로워" defaultChecked={enabled("followers")}/><Checkbox name="replies" label="댓글·답글" defaultChecked={enabled("replies")}/><Checkbox name="reactions" label="좋아요" defaultChecked={enabled("reactions")}/><Checkbox name="announcements" label="서비스 안내" defaultChecked={enabled("announcements")}/></fieldset><p className="field-hint">알림 전달 기능은 소셜 기능이 추가된 뒤 사용할 수 있어요.</p></ActionForm>;
}
export function ReauthForm({hasPassword}: {hasPassword:boolean}) {
  return <div className="reauth-forms"><ActionForm action={reauthenticate} submitLabel="계정 확인"><Select name="purpose" label="확인할 작업" defaultValue="password_change"><option value="password_change">비밀번호 변경</option><option value="email_change">이메일 변경</option></Select><Select name="method" label="확인 방법" defaultValue={hasPassword ? "password" : "otp"}>{hasPassword ? <option value="password">현재 비밀번호</option> : null}<option value="otp">이메일 확인 코드</option></Select>{hasPassword ? <Field name="currentPassword" label="현재 비밀번호 (선택한 경우)" type="password" autoComplete="current-password" maxLength={512}/> : null}<Field name="otp" label="이메일 확인 코드 (선택한 경우)" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}/></ActionForm><ActionForm action={sendReauthOtp} submitLabel="이메일 확인 코드 받기">{null}</ActionForm></div>;
}
export function EmailChangeForm() { return <ActionForm action={changeEmail} submitLabel="이메일 변경 요청"><Field name="email" label="새 이메일" type="email" autoComplete="email" maxLength={254} required/></ActionForm>; }
export function AvatarForm() {
  return <><ActionForm action={uploadAvatar} submitLabel="프로필 사진 저장"><Field name="avatar" label="프로필 사진" type="file" accept="image/jpeg,image/png,image/webp" required hint="JPEG·PNG·WebP, 최대 2MB. 사진은 공개되며 위치 등 파일 메타데이터는 제거해요."/></ActionForm><ActionForm action={removeAvatar} submitLabel="프로필 사진 제거">{null}</ActionForm></>;
}
