import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { DesktopNavigation } from "./navigation";
import { ThemeSwitcher } from "./theme-switcher";
import { Suspense } from "react";
import { SessionMenu } from "./auth/session-menu";

export function AppHeader() {
  return <header className="app-header">
    <div className="header-inner">
      <Link className="brand" href="/" aria-label="ToonShelf 홈">
        <span className="brand-mark" aria-hidden="true">TS</span>
        <span>ToonShelf</span>
      </Link>
      <form className="header-search" action="/explore" method="get" role="search" aria-label="작품 검색">
        <Search size={16} aria-hidden="true" />
        <input type="search" name="q" aria-label="작품 제목·별칭·작가" placeholder="작품 제목, 작가로 검색" maxLength={200} />
        <button type="submit" aria-label="작품 찾기"><Search size={16} aria-hidden="true" /></button>
      </form>
      <DesktopNavigation />
      <div className="header-actions"><Link className="header-icon header-mobile-search" href="/explore" aria-label="작품 검색"><Search size={18} aria-hidden="true"/></Link><ThemeSwitcher /><button className="header-icon" type="button" disabled aria-label="알림 · 준비 중" title="알림 기능 준비 중"><Bell size={18} aria-hidden="true"/></button><div className="header-account"><Suspense fallback={<Link className="header-profile" href="/settings/profile">내 계정</Link>}><SessionMenu/></Suspense></div></div>
    </div>
  </header>;
}
