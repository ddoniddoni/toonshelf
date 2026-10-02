import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env/public";
import { usernameSchema } from "@/lib/auth/validation";
import { databaseError } from "@/lib/auth/errors";
import { UserAvatar } from "@/components/account/user-avatar";
import Link from "next/link";
import { getPublicLibrary,getReadingStats } from "@/lib/library/data";
import { parsePage,readingLabels } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { WorkCard } from "@/components/catalogue/work-card";
import { CopyToLibrary } from "@/components/library/record-form";
import { ReadingStatistics } from "@/components/library/reading-stats";
import { listReviews } from "@/lib/reviews/data";
import { ReviewList } from "@/components/reviews/review-list";
import { getCurrentAccount } from "@/lib/auth/session";
import { BlockForm } from "@/components/reviews/forms";
export const dynamic = "force-dynamic";
const getProfile = cache(async (username:string) => {
  if (!getPublicEnv().supabase || !usernameSchema.safeParse(username).success) return null;
  const {data,error} = await (await createClient()).from("profiles").select("id,username,display_name,bio,avatar_path,onboarding_completed_at").eq("username",username).not("onboarding_completed_at","is",null).maybeSingle();
  databaseError(error); return data;
});
export async function generateMetadata({params}: {params:Promise<{username:string}>}) {
  const profile = await getProfile((await params).username);
  return {title:profile ? `${profile.display_name}의 프로필` : "프로필",robots:{index:false,follow:false}};
}
export default async function Page({params,searchParams}: {params:Promise<{username:string}>;searchParams:Promise<SearchParams>}) {
  const {username} = await params;const profile = await getProfile(username); if (!profile) notFound();
  let page:number;try { page = parsePage((await searchParams).page); } catch { return <section className="page-container"><p role="alert">페이지 번호를 확인해 주세요.</p><Link href={"/u/"+username}>프로필로 돌아가기</Link></section>; }
  const [library,stats,reviews,account] = await Promise.all([getPublicLibrary(username,page),getReadingStats(username),listReviews(null,username,1),getCurrentAccount()]);
  if (!library || !stats) notFound();
  return <section className="page-container public-profile"><UserAvatar path={profile.avatar_path} name={profile.display_name}/><p className="eyebrow">@{profile.username}</p><h1>{profile.display_name}</h1><p className="profile-bio">{profile.bio || "아직 소개를 남기지 않았어요."}</p>
    <ReadingStatistics stats={stats} isPublic/><h2>공개 서재와 평가 · {library.total}편</h2><p className="field-hint">서재와 평가가 각각 공개된 경우에만 표시돼요. 비공개 기록·메모·회차·태그는 포함하지 않아요.</p>
    <div className="public-library-grid">{library.items.map(item=><article className="public-library-item" key={item.work.id}><WorkCard work={item.work}/><p>{item.status ? readingLabels[item.status] : "읽기 상태 비공개"} · {item.ratingSteps === null ? "공개 별점 없음" : (item.ratingSteps/2).toFixed(1)+"점"} · {item.canonicalTier ? "티어 "+item.canonicalTier : "공개 티어 없음"}</p><CopyToLibrary workId={item.work.id}/></article>)}</div>
    {!library.items.length ? <p>이 페이지에 공개된 기록이 없어요.</p> : null}<nav className="library-pagination" aria-label="공개 서재 페이지">{page > 1 ? <Link href={"/u/"+username+"?page="+(page-1)}>이전</Link> : null}{library.hasNext ? <Link href={"/u/"+username+"?page="+(page+1)}>다음</Link> : null}</nav>
    <h2>공개 리뷰 · {reviews?.total ?? 0}개</h2><ReviewList items={reviews?.items.slice(0,3) ?? []}/><Link className="text-link" href={"/u/"+username+"/reviews"}>공개 리뷰 모두 보기 →</Link>
    {account?.access.status === "active" && account.access.consents_current && account.user.id !== profile.id ? <details className="library-privacy-panel"><summary>사용자 차단</summary><BlockForm userId={profile.id} name={profile.display_name}/></details> : null}
    <p className="field-hint">작품 저장은 로그인 후 가능해요. 공개 티어표는 다음 단계에서 이어갈 예정이에요.</p></section>;
}
