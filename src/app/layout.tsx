import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { MobileNavigation } from "@/components/navigation";
import { ThemeProvider } from "@/components/theme-provider";
import { getServerEnv } from "@/lib/env/server";
import "./globals.css";

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
      <footer className="app-footer"><span className="footer-brand">toonshelf.</span><span>읽은 이야기, 오래 남는 취향.</span><span className="footer-preview">미리 보기</span></footer>
      <MobileNavigation />
    </ThemeProvider>
  </body></html>;
}
