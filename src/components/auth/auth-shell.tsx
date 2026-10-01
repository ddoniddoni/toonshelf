import Link from "next/link";
import type { ReactNode } from "react";
import { getPublicEnv } from "@/lib/env/public";

export function ConnectionNotice() {
  return <div className="connection-notice" role="status"><strong>계정 기능을 준비하고 있어요</strong><p>서비스 연결이 완료되면 가입하고 기록을 저장할 수 있어요. 지금은 공개 화면을 둘러볼 수 있어요.</p><Link className="text-link" href="/">홈으로 돌아가기</Link></div>;
}
export function AuthShell({title,description,children,requireConnection=true}: {title:string;description:string;children:ReactNode;requireConnection?:boolean}) {
  const connected = Boolean(getPublicEnv().supabase);
  return <section className="page-container auth-page"><div className="auth-intro"><p className="eyebrow">나의 웹툰 서재</p><h1>{title}</h1><p>{description}</p><div className="auth-bookplate" aria-hidden="true"><span>THIS SHELF BELONGS TO</span><strong>이야기를<br/>기록하는 나.</strong><span>toonshelf.</span></div></div><div className="auth-panel">{requireConnection && !connected ? <ConnectionNotice/> : children}</div></section>;
}
