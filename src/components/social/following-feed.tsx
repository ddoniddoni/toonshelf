import Link from "next/link";
import { UserAvatar } from "@/components/account/user-avatar";
import { feedUrl,type FollowingFeed as Feed } from "@/lib/social/feed-model";

export function FollowingFeed({feed,hasCursor}:{feed:Feed;hasCursor:boolean}) {
 return <>
  <div className="following-feed-list">{feed.items.map(item=><article className="review-card following-feed-card" key={item.eventId}>
   <div className="following-feed-author"><UserAvatar path={item.author.avatarPath} name={item.author.name}/><div>
    <Link className="text-link" href={`/u/${item.author.username}`} prefetch={false}>{item.author.name} <span className="field-hint">@{item.author.username}</span></Link>
    <p className="field-hint">{item.kind === "review" ? "공개 리뷰" : item.kind === "post" ? "커뮤니티 글" : "공개 티어리스트"} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time></p>
   </div></div>
   {item.kind === "review" ? <>
    <h2><Link href={`/reviews/${item.id}`} prefetch={false}>{item.work.title} 리뷰</Link></h2>
    {item.isSpoiler ? <p className="following-feed-spoiler">스포일러가 포함된 리뷰예요. 상세 화면에서 확인할 수 있어요.</p> : <p className="following-feed-excerpt">{item.excerpt}</p>}
    <Link className="text-link" href={`/reviews/${item.id}`} prefetch={false}>리뷰 보기 →</Link>
   </> : item.kind === "post" ? <>
    <h2><Link href={`/posts/${item.id}`} prefetch={false}>{item.title ?? "스포일러가 포함된 글"}</Link></h2>
    {item.isSpoiler ? <p className="following-feed-spoiler">제목과 내용은 상세 화면에서 확인할 수 있어요.</p> : <p className="following-feed-excerpt">{item.excerpt}</p>}
    <Link className="text-link" href={`/posts/${item.id}`} prefetch={false}>글 보기 →</Link>
   </> : <>
    <h2><Link href={`/tiers/${item.id}`} prefetch={false}>{item.title ?? "스포일러가 포함된 티어리스트"}</Link></h2>
    {item.isSpoiler ? <p className="following-feed-spoiler">제목과 배치는 상세 화면에서 확인할 수 있어요.</p> : <p>작품을 어떻게 배치했는지 살펴보세요.</p>}
    <Link className="text-link" href={`/tiers/${item.id}`} prefetch={false}>티어리스트 보기 →</Link>
   </>}
  </article>)}</div>
  {!feed.items.length ? <div className="library-empty">
   <h2>{!feed.hasFollowing ? "관심 있는 독자를 팔로우해 보세요" : hasCursor ? "이전에 공개된 게시물이 더 없어요" : "아직 공개된 게시물이 없어요"}</h2>
   <p>{!feed.hasFollowing ? "공개 티어리스트나 리뷰에서 독자의 프로필을 열고 팔로우하면 이곳에서 새 게시물을 볼 수 있어요." : "팔로우한 독자가 공개한 리뷰·티어리스트·커뮤니티 글을 이곳에 모아 보여드려요."}</p>
   <Link className="button button-secondary" href="/tiers" prefetch={false}>티어리스트에서 독자 찾기</Link>
  </div> : null}
  <nav className="library-pagination" aria-label="팔로잉 피드 페이지">
   {hasCursor ? <Link className="button button-secondary" href={feedUrl()} prefetch={false}>최신 게시물로</Link> : null}
   {feed.nextCursor ? <Link className="button button-secondary" href={feedUrl(feed.nextCursor)} prefetch={false}>이전 게시물 더 보기</Link> : null}
  </nav>
 </>;
}
