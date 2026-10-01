export function LoadingSkeleton() {
  return <div className="loading-state" role="status" aria-label="화면을 불러오는 중">
    <span className="sr-only">화면을 불러오는 중입니다.</span>
    <div className="skeleton skeleton-short" /><div className="skeleton skeleton-heading" />
    <div className="skeleton skeleton-panel" />
  </div>;
}
