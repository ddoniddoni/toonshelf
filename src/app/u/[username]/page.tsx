import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { usernameSchema } from "@/lib/auth/validation";
import { databaseError } from "@/lib/auth/errors";
import { UserAvatar } from "@/components/account/user-avatar";
export const dynamic = "force-dynamic";
const getProfile = cache(async (username:string) => {
  if (!getPublicEnv().supabase || !usernameSchema.safeParse(username).success) return null;
  const {data,error} = await (await createClient()).from("profiles").select("username,display_name,bio,avatar_path,onboarding_completed_at").eq("username",username).not("onboarding_completed_at","is",null).maybeSingle();
  databaseError(error); return data;
});
export async function generateMetadata({params}: {params:Promise<{username:string}>}) {
  const profile = await getProfile((await params).username);
  return {title:profile ? `${profile.display_name}의 프로필` : "프로필",robots:{index:false,follow:false}};
}
export default async function Page({params}: {params:Promise<{username:string}>}) {
  const profile = await getProfile((await params).username); if (!profile) notFound();
  return <section className="page-container public-profile"><UserAvatar path={profile.avatar_path} name={profile.display_name}/><p className="eyebrow">@{profile.username}</p><h1>{profile.display_name}</h1><p className="profile-bio">{profile.bio || "아직 소개를 남기지 않았어요."}</p><p className="field-hint">공개 서재와 티어리스트는 기록 기능이 추가된 뒤 볼 수 있어요.</p></section>;
}
