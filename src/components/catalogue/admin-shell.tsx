import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";
export function AdminShell({title,description,connected,children}:{title:string;description:string;connected:boolean;children:ReactNode}) {
  return <div className="page-container admin-page"><header className="catalogue-heading"><div><p className="eyebrow">카탈로그 관리</p><h1>{title}</h1><p>{description}</p></div><Link className="text-link" href="/explore">공개 카탈로그</Link></header>
    <nav className="admin-navigation" aria-label="카탈로그 관리"><Link href="/admin/works">작품</Link><Link href="/admin/submissions">제보</Link><Link href="/admin/assets">표지 권리</Link><Link href="/admin/audit">관리 이력</Link></nav>
    {connected ? children : <EmptyState title="관리 기능 연결을 준비하고 있어요" description="연결 후 권한이 확인된 관리자가 작품 정보와 출처를 등록할 수 있어요."/>}
  </div>;
}
