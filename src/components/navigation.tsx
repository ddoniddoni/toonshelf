"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Search, Library, Layers3, UserRound } from "lucide-react";

const desktopLinks = [
  { href: "/", label: "홈" },
  { href: "/explore", label: "작품 탐색" },
  { href: "/rankings", label: "실시간 순위" },
  { href: "/tiers", label: "독자 티어리스트" },
  { href: "/me/feed", label: "팔로잉 피드" },
  { href: "/me/library", label: "내 서재" },
];

function activePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/explore") return pathname === "/explore" || pathname.startsWith("/works/");
  if (href === "/tiers" && pathname.startsWith("/me/tiers")) return true;
  if (href === "/settings/profile") return pathname.startsWith("/settings/");
  return pathname === href || pathname.startsWith(href + "/");
}
const mobileLinks = [
  { href: "/", label: "홈", Icon: House },
  { href: "/explore", label: "탐색", Icon: Search },
  { href: "/me/library", label: "내 서재", Icon: Library },
  { href: "/tiers", label: "티어", Icon: Layers3 },
  { href: "/settings/profile", label: "내 프로필", Icon: UserRound },
];

export function DesktopNavigation() {
  const pathname = usePathname();
  return <nav className="desktop-navigation" aria-label="주 메뉴">
    {desktopLinks.map(({ href, label }) => <Link key={href} href={href} prefetch={href === "/me/feed" ? false : undefined} aria-current={activePath(pathname,href) ? "page" : undefined}>{label}</Link>)}
  </nav>;
}

export function MobileNavigation() {
  const pathname = usePathname();
  return <nav className="mobile-navigation" aria-label="모바일 주 메뉴">
    {mobileLinks.map(({ href, label, Icon }) => <Link key={href} href={href} aria-current={activePath(pathname,href) ? "page" : undefined}>
      <Icon size={20} aria-hidden="true" /><span>{label}</span>
    </Link>)}
  </nav>;
}
