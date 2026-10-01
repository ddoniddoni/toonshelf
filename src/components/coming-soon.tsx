import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "./ui/empty-state";

export function ComingSoon({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-container upcoming-page">
    <Link className="back-link" href="/"><ArrowLeft size={17} aria-hidden="true" />홈으로</Link>
    <p className="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <EmptyState title="조금 더 좋은 서재를 준비하고 있어요" description={description}
      action={<Link className="button button-secondary" href="/#about">ToonShelf 살펴보기</Link>} />
    <p className="preview-note">현재 미리 보기 버전으로, 회원가입과 기록 저장은 아직 제공하지 않습니다.</p>
  </div>;
}
