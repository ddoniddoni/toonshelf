// UI mocks WRITTEN ONLY; no browser, real user flow or permission checks run.
import { act,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({set:vi.fn(),reload:vi.fn(),refresh:vi.fn()}));
vi.mock("@/lib/social/actions",()=>({setUserFollow:mocks.set,reloadUserFollow:mocks.reload}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
import { FollowPanel } from "@/components/social/follow-panel";
const state={id:"32000000-0000-4000-8000-000000000002",username:"reader_two",name:"독자",avatarPath:null,followerCount:0,followingCount:0,following:false,canFollow:true,isSelf:false};
describe("follow acknowledgements (written only)",()=>{
 beforeEach(()=>{vi.resetAllMocks();});
 it("locks duplicate submissions and waits for acknowledgement before changing state/counts",async()=>{
  let finish:(value:unknown)=>void=()=>{};mocks.set.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  render(<FollowPanel initial={state}/>);fireEvent.click(screen.getByRole("button",{name:"팔로우",exact:true}));
  expect(screen.getByRole("button",{name:"처리 중…"})).toBeDisabled();expect(screen.getByRole("link",{name:"팔로워 0"})).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"처리 중…"}));expect(mocks.set).toHaveBeenCalledTimes(1);
  await act(async()=>{finish({ok:true,state:{...state,following:true,followerCount:1}});});
  expect(screen.getByRole("button",{name:"팔로우 해제"})).toHaveAttribute("aria-pressed","true");
  expect(screen.getByRole("link",{name:"팔로워 1"})).toHaveAttribute("href","/u/reader_two/followers");
 });
 it("keeps acknowledged state after rate denial and rechecks before retrying an ambiguous write",async()=>{
  mocks.set.mockResolvedValueOnce({ok:false,error:{code:"RATE_LIMITED",message:"잠시 기다려 주세요"}}).mockRejectedValueOnce(new Error("lost response"));
  mocks.reload.mockResolvedValue({ok:true,state:{...state,following:true,followerCount:1}});
  render(<FollowPanel initial={state}/>);fireEvent.click(screen.getByRole("button",{name:"팔로우",exact:true}));
  await screen.findByText("잠시 기다려 주세요");expect(screen.getByRole("link",{name:"팔로워 0"})).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"팔로우",exact:true}));await screen.findByText("처리 결과를 확인하지 못했어요. 현재 상태를 다시 확인해 주세요.");
  expect(screen.queryByRole("button",{name:"팔로우",exact:true})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"현재 팔로우 상태 다시 확인"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"팔로우 해제"})).toHaveAttribute("aria-pressed","true"));
 });
 it("shows no mutation control to self or guests and replaces local state after server refresh",()=>{
  const {rerender}=render(<FollowPanel initial={{...state,isSelf:true,canFollow:false}}/>);
  expect(screen.queryByRole("button",{name:"팔로우",exact:true})).toBeNull();
  rerender(<FollowPanel initial={{...state,canFollow:false}}/>);
  expect(screen.getByRole("link",{name:"로그인과 계정 확인"})).toHaveAttribute("href","/auth/sign-in?returnTo=%2Fu%2Freader_two");
  rerender(<FollowPanel initial={{...state,following:true,followerCount:1}}/>);
  expect(screen.getByRole("button",{name:"팔로우 해제"})).toHaveAttribute("aria-pressed","true");expect(mocks.set).not.toHaveBeenCalled();
 });
});
