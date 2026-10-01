import Link from "next/link";
import { BookOpen } from "lucide-react";
import { DesktopNavigation } from "./navigation";
import { ThemeSwitcher } from "./theme-switcher";

export function AppHeader() {
  return <header className="app-header">
    <div className="header-inner">
      <Link className="brand" href="/" aria-label="ToonShelf 홈">
        <span className="brand-mark"><BookOpen size={22} strokeWidth={2.5} aria-hidden="true" /></span>
        <span>toon<span className="brand-light">shelf</span><span className="brand-period">.</span></span>
      </Link>
      <DesktopNavigation />
      <div className="header-actions"><ThemeSwitcher /><Link className="button button-small button-secondary header-library" href="/me/library">내 서재</Link></div>
    </div>
  </header>;
}
