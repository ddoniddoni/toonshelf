import { render,screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe,expect,it,vi } from "vitest";
vi.mock("next/link",()=>({default:({children,href}:PropsWithChildren<{href:string}>)=><a href={href}>{children}</a>}));
vi.mock("@/components/account/user-avatar",()=>({UserAvatar:()=>null}));
import { PostList } from "@/components/posts/post-list";
import { FollowingFeed } from "@/components/social/following-feed";
const id="35000000-0000-4000-8000-000000000001";
describe("post spoiler presentation (written only)",()=>{
 it("shows a generic card and explicit detail link for spoiler posts",()=>{
  render(<PostList posts={[{id,authorId:id,username:"reader",name:"독자",avatar:null,title:null,excerpt:null,category:"general",isSpoiler:true,version:1,publishedAt:"2026-10-08T09:00:00Z",updatedAt:"2026-10-08T09:00:00Z",works:[]}]}/>);
  expect(screen.getByRole("link",{name:"스포일러가 포함된 글"})).toHaveAttribute("href",`/posts/${id}`);
 });
 it("routes community feed items to posts, never to tiers",()=>{
  render(<FollowingFeed hasCursor={false} feed={{hasFollowing:true,nextCursor:null,items:[{kind:"post",id,eventId:id,author:{id,username:"reader",name:"독자",avatarPath:null},createdAt:"2026-10-08T09:00:00.000001Z",isSpoiler:true,title:null,excerpt:null}]}}/>);
  expect(screen.getByRole("link",{name:"글 보기 →"})).toHaveAttribute("href",`/posts/${id}`);
 });
});
