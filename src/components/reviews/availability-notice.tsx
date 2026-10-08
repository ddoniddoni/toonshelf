import Link from "next/link";
export function ReviewAvailabilityNotice({href}:{href:string}) {
 return <section className="review-empty" role="status"><p>리뷰 좋아요·댓글 기능을 준비하고 있어요. 잠시 후 다시 방문해 주세요.</p><Link className="text-link" href={href} prefetch={false}>돌아가기 →</Link></section>;
}
