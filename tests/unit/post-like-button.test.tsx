// Written UI mocks only; not browser or real permission verification.
import { act,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({set:vi.fn(),reload:vi.fn(),refresh:vi.fn()}));
vi.mock("@/lib/posts/like-actions",()=>({setPostLike:mocks.set,reloadPostLike:mocks.reload}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
import { PostLikeButton } from "@/components/posts/like-button";
const id="20000000-0000-4000-8000-000000000001",state={id,version:2,likeCount:5,liked:false,canLike:true};
describe("post like acknowledgements",()=>{
 beforeEach(()=>{vi.resetAllMocks();});
 it("disables duplicate submissions and changes count/pressed state only after acknowledgement",async()=>{
  let finish:(value:unknown)=>void=()=>{};mocks.set.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  render(<PostLikeButton initial={state} id={id} version={2} own={false} active/>);
  fireEvent.click(screen.getByRole("button",{name:"좋아요"}));expect(screen.getByRole("button",{name:"확인 중…"})).toBeDisabled();expect(screen.getByText("좋아요 5개")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"확인 중…"}));expect(mocks.set).toHaveBeenCalledTimes(1);
  await act(async()=>{finish({ok:true,state:{...state,liked:true,likeCount:6}});});
  expect(screen.getByRole("button",{name:"좋아요 취소"})).toHaveAttribute("aria-pressed","true");expect(screen.getByText("좋아요 6개")).toBeVisible();
 });
 it("preserves the displayed state after a denied rate request and rechecks an ambiguous response",async()=>{
  mocks.set.mockResolvedValueOnce({ok:false,error:{code:"RATE_LIMITED",message:"잠시 기다려 주세요"}}).mockRejectedValueOnce(new Error("connection lost"));
  mocks.reload.mockResolvedValue({ok:true,state:{...state,liked:true,likeCount:6}});
  render(<PostLikeButton initial={state} id={id} version={2} own={false} active/>);
  fireEvent.click(screen.getByRole("button",{name:"좋아요"}));await screen.findByText("잠시 기다려 주세요");expect(screen.getByText("좋아요 5개")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"좋아요"}));await screen.findByText("처리 결과를 확인하지 못했어요. 현재 상태를 다시 확인해 주세요.");expect(screen.queryByRole("button",{name:"좋아요"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"현재 좋아요 상태 다시 확인"}));await waitFor(()=>expect(screen.getByRole("button",{name:"좋아요 취소"})).toHaveAttribute("aria-pressed","true"));
 });
 it("keeps owner/anonymous buttons read-only without sending a write",()=>{
  const {rerender}=render(<PostLikeButton initial={{...state,canLike:false}} id={id} version={2} own active/>);
  expect(screen.getByRole("button",{name:"좋아요"})).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"좋아요"}));expect(mocks.set).not.toHaveBeenCalled();
  rerender(<PostLikeButton initial={{...state,canLike:false}} id={id} version={2} own={false} active={false}/>);
  expect(screen.getByRole("button",{name:"좋아요"})).toBeDisabled();expect(screen.getByRole("link",{name:"로그인과 계정 확인"})).toHaveAttribute("href",`/auth/sign-in?returnTo=${encodeURIComponent(`/posts/${id}`)}`);
 });
});
