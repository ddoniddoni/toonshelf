import Link from "next/link";
import type { ReactNode } from "react";
import { ConnectionNotice } from "@/components/auth/auth-shell";
export function AccountShell({title,description,connected,children}: {title:string;description:string;connected:boolean;children:ReactNode}) {
  return <section className="page-container account-page"><div className="account-heading"><p className="eyebrow">나의 계정</p><h1>{title}</h1><p>{description}</p></div><div className="account-layout"><nav className="settings-navigation" aria-label="계정 설정"><Link href="/settings/profile">프로필</Link><Link href="/settings/account">로그인과 보안</Link><Link href="/settings/privacy">공개 범위와 알림</Link><Link href="/settings/blocks">차단한 사용자</Link><Link href="/me/notifications" prefetch={false}>내 알림</Link><Link href="/me/feed" prefetch={false}>팔로잉 피드</Link><Link href="/me/posts" prefetch={false}>내 글과 초안</Link><Link href="/me/reviews">내 리뷰</Link><Link href="/me/reports">내 신고 접수</Link></nav><div className="account-panel">{connected ? children : <ConnectionNotice/>}</div></div></section>;
}
