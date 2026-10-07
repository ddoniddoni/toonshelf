import Link from "next/link";
import { z } from "zod";
import { guardPage } from "@/lib/auth/session";
import { AuthFailure } from "@/lib/auth/errors";
import type { SearchParams } from "@/lib/catalogue/model";
import { getFollowingFeed } from "@/lib/social/feed-data";
import { type FollowingFeed as Feed } from "@/lib/social/feed-model";
import { FollowingFeed } from "@/components/social/following-feed";
import { ConnectionNotice } from "@/components/auth/auth-shell";

export const dynamic="force-dynamic";
export const metadata={title:"팔로잉 피드",description:"팔로우한 독자의 공개 리뷰와 티어리스트를 모아 봐요.",robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<SearchParams>}) {
 const account=await guardPage("/me/feed");
 if (!account) return <section className="page-container following-feed-page"><h1>팔로잉 피드</h1><ConnectionNotice/></section>;
 const params=await searchParams;
 let feed:Feed;
 try {feed=await getFollowingFeed(params);} catch(error) {
  if (!(error instanceof z.ZodError) && !(error instanceof AuthFailure && error.code === "VALIDATION_ERROR")) throw error;
  return <section className="page-container following-feed-page"><h1>팔로잉 피드</h1><p role="alert">페이지 주소를 확인해 주세요. 최신 게시물부터 다시 볼 수 있어요.</p><Link href="/me/feed" className="text-link" prefetch={false}>최신 게시물로</Link></section>;
 }
 return <section className="page-container following-feed-page">
  <div className="hub-section-heading"><div><p className="eyebrow">FOLLOWING</p><h1>팔로잉 피드</h1><p>함께 읽는 독자들의 리뷰와 티어리스트.</p></div><Link className="button button-secondary" href="/tiers" prefetch={false}>독자 찾아보기</Link></div>
  <p className="field-hint">공개 게시순으로 보여드려요. 수정·재게시해도 순서는 바뀌지 않으며, 지금 볼 수 있는 게시물만 표시해요. 시간은 한국 기준이에요.</p>
  <FollowingFeed feed={feed} hasCursor={params.cursor !== undefined}/>
 </section>;
}
