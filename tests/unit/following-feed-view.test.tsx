// Written only. No browser or user flow has been executed.
import { cleanup,render,screen } from "@testing-library/react";
import { afterEach,describe,expect,it,vi } from "vitest";
vi.mock("@/components/account/user-avatar",()=>({UserAvatar:()=>null}));
import { FollowingFeed } from "@/components/social/following-feed";
import type { FollowingFeed as Feed } from "@/lib/social/feed-model";
afterEach(cleanup);
const author={id:"33000000-0000-4000-8000-000000000002",username:"feed_author",name:"피드 독자",avatarPath:null};
const common={id:"73000000-0000-4000-8000-000000000001",eventId:"93000000-0000-4000-8000-000000000001",createdAt:"2026-10-07T10:00:00.123456Z",author,isSpoiler:true};
describe("following feed view (written only)",()=>{
 it("links spoiler reviews and tiers to their existing detail gates",()=>{
  const feed:Feed={hasFollowing:true,nextCursor:"next_cursor",items:[{...common,kind:"review",work:{id:common.id,title:"테스트 작품",slug:"test-work"},excerpt:null},
   {...common,eventId:"93000000-0000-4000-8000-000000000002",kind:"tier",title:null}]};
  render(<FollowingFeed feed={feed} hasCursor={true}/>);
  expect(screen.getByRole("link",{name:"리뷰 보기 →"})).toHaveAttribute("href",`/reviews/${common.id}`);
  expect(screen.getByRole("link",{name:"티어리스트 보기 →"})).toHaveAttribute("href",`/tiers/${common.id}`);
  expect(screen.getByText("스포일러가 포함된 티어리스트")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"이전 게시물 더 보기"})).toHaveAttribute("href","/me/feed?cursor=next_cursor");
  expect(screen.getByRole("link",{name:"최신 게시물로"})).toHaveAttribute("href","/me/feed");
 });
 it("distinguishes no follows, no public posts, and the end of earlier posts",()=>{
  const {rerender}=render(<FollowingFeed feed={{hasFollowing:false,items:[],nextCursor:null}} hasCursor={false}/>);
  expect(screen.getByRole("heading",{name:"관심 있는 독자를 팔로우해 보세요"})).toBeInTheDocument();
  rerender(<FollowingFeed feed={{hasFollowing:true,items:[],nextCursor:null}} hasCursor={false}/>);
  expect(screen.getByRole("heading",{name:"아직 공개된 게시물이 없어요"})).toBeInTheDocument();
  rerender(<FollowingFeed feed={{hasFollowing:true,items:[],nextCursor:null}} hasCursor={true}/>);
  expect(screen.getByRole("heading",{name:"이전에 공개된 게시물이 더 없어요"})).toBeInTheDocument();
  expect(screen.queryByRole("link",{name:"이전 게시물 더 보기"})).not.toBeInTheDocument();
 });
});
