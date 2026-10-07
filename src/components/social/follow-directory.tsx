import Link from "next/link";
import { notFound } from "next/navigation";
import { usernameSchema } from "@/lib/auth/validation";
import { parsePage } from "@/lib/library/model";
import type { SearchParams } from "@/lib/catalogue/model";
import { listPublicFollows } from "@/lib/social/data";
import type { FollowKind } from "@/lib/social/model";
import { UserAvatar } from "@/components/account/user-avatar";
import { FollowPanel } from "./follow-panel";

export async function FollowDirectory({username,kind,searchParams}:{username:string;kind:FollowKind;searchParams:SearchParams}) {
 if (!usernameSchema.safeParse(username).success) notFound();
 const base=`/u/${username}/${kind}`,label=kind === "followers" ? "팔로워" : "팔로잉";
 let page:number;
 try {page=parsePage(searchParams.page);} catch {
  return <section className="page-container public-profile"><h1>{label}</h1><p role="alert">페이지 번호를 확인해 주세요.</p><Link className="text-link" href={base}>목록으로 돌아가기</Link></section>;
 }
 const list=await listPublicFollows(username,kind,page);if (!list) notFound();
 return <section className="page-container public-profile">
  <Link className="text-link" href={`/u/${username}`}>← {list.profile.name}의 프로필</Link>
  <p className="eyebrow">@{username}</p><h1>{label} · {list.total.toLocaleString("ko-KR")}명</h1>
  <FollowPanel initial={list.profile}/>
  <p className="field-hint">최근 팔로우한 순서로 표시해요. 차단한 사용자와 비활성 계정은 목록과 인원수에서 제외돼요.</p>
  <ul className="follow-directory">{list.items.map(user=><li key={user.id}><Link className="follow-person" href={`/u/${user.username}`}><UserAvatar path={user.avatarPath} name={user.name}/><span><strong>{user.name}</strong><span>@{user.username}</span></span></Link></li>)}</ul>
  {!list.items.length ? <p>{list.total === 0 ? `현재 표시할 ${label}가 없어요.` : "이 페이지에는 표시할 사용자가 없어요."}</p> : null}
  <nav className="library-pagination" aria-label={`${label} 페이지`}>
   {page > 1 ? <Link href={`${base}?page=${page-1}`}>이전</Link> : null}
   {list.hasNext ? <Link href={`${base}?page=${page+1}`}>다음</Link> : null}
  </nav>
 </section>;
}
