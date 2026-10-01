import Link from "next/link";
export default function NotFound() {
  return <div className="page-container not-found"><p className="eyebrow">404 · 비어 있는 페이지</p><h1>찾으시는 이야기가 없어요</h1><p>주소를 다시 확인하거나 서재의 처음으로 돌아가 주세요.</p><Link className="button button-primary" href="/">홈으로 돌아가기</Link></div>;
}
