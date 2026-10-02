import { Fragment } from "react";
import { safeReviewLink } from "@/lib/reviews/model";
export function ReviewText({body}:{body:string}) {
 return <div className="review-body">{body.split(/(https?:\/\/[^\s<>]+)/g).map((part,index)=>{
  const url = /^https?:\/\//.test(part) ? safeReviewLink(part) : null;
  return <Fragment key={index}>{url ? <a href={url} target="_blank" rel="noopener noreferrer nofollow ugc">{part}<span className="sr-only"> (외부 사이트에서 열기)</span> ↗</a> : part}</Fragment>;
 })}</div>;
}
