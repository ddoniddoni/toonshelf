import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MobileNavigation } from "@/components/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { getServerEnv } from "@/lib/env/server";
import "./globals.css";
import "./stitch.css";

export const metadata: Metadata = {
  title: { default: "ToonShelf · 취향을 담는 웹툰 서재", template: "%s · ToonShelf" },
  description: "여러 곳에서 만난 웹툰을 하나의 서재에. 읽고, 기록하고, 나만의 티어로 취향을 발견하세요.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  getServerEnv();
  return <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning><body>
    <ThemeProvider>
      <a className="skip-link" href="#main-content">본문으로 바로 가기</a>
      <AppHeader />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="app-footer"><div className="footer-inner"><div className="footer-summary"><Link href="/" className="footer-brand">ToonShelf</Link><span className="footer-preview">개발 미리 보기</span><p>웹툰은 공식 플랫폼에서, 기록은 나만의 서재에서. ToonShelf는 웹툰 기록과 리뷰를 위한 서비스예요.</p></div><nav aria-label="서비스 안내"><Link href="/legal/terms">이용약관</Link><Link href="/legal/privacy">개인정보처리방침</Link><Link href="/community">커뮤니티</Link><Link href="/submissions/new">작품 정보 제보</Link></nav></div></footer>
      <MobileNavigation />
    </ThemeProvider>
  </body></html>;
}
