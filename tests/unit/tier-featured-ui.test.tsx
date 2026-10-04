// Written UI mocks only; no browser or permission verification.
import { act,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({set:vi.fn(),refresh:vi.fn()}));
vi.mock("@/lib/tiers/featured-actions",()=>({setFeaturedTier:mocks.set}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
import { FeaturedTierControl } from "@/components/tiers/featured-tier-control";
import { FeaturedTierCard } from "@/components/tiers/featured-tier-card";
const id="20000000-0000-4000-8000-000000000001";
const tier={id,version:2,visibility:"public" as const,publishedVersion:1,moderationStatus:"visible" as const,publishedAt:"2026-10-05T00:00:00Z",hasShareToken:false};
describe("featured tier UI boundaries",()=>{
 beforeEach(()=>{vi.resetAllMocks();});
 it("waits for acknowledgement, blocks duplicates, and refreshes the server revision",async()=>{
  let finish:(reply:unknown)=>void=()=>{};mocks.set.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  render(<FeaturedTierControl featured={{id:null,version:1}} tier={tier}/>);
  fireEvent.click(screen.getByRole("button",{name:"이 티어표를 대표로 지정"}));
  await waitFor(()=>expect(mocks.set).toHaveBeenCalledWith({id,tierVersion:2,featuredVersion:1}));
  expect(screen.getByRole("button",{name:"이 티어표를 대표로 지정"})).toBeDisabled();expect(screen.queryByText("공개 프로필의 대표 티어표로 지정했어요.")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"이 티어표를 대표로 지정"}));expect(mocks.set).toHaveBeenCalledTimes(1);
  await act(async()=>{finish({ok:true,state:{id,version:2}});});expect(mocks.refresh).toHaveBeenCalled();expect(screen.getByText("공개 프로필의 대표 티어표로 지정했어요.")).toBeVisible();
 });
 it("offers unset without selecting private/unlisted/hidden targets",()=>{
  const view=render(<FeaturedTierControl featured={{id,version:3}} tier={{...tier,visibility:"private",publishedVersion:null}}/>);
  expect(screen.queryByRole("button",{name:/대표로 지정|대표 변경/})).toBeNull();expect(screen.getByRole("button",{name:"대표 지정 해제"})).toBeVisible();
  view.rerender(<FeaturedTierControl featured={{id:null,version:4}} tier={{...tier,visibility:"unlisted"}}/>);expect(screen.queryByRole("button",{name:/대표로 지정|대표 변경/})).toBeNull();
  view.rerender(<FeaturedTierControl featured={{id:null,version:4}} tier={{...tier,moderationStatus:"hidden"}}/>);expect(screen.queryByRole("button",{name:/대표로 지정|대표 변경/})).toBeNull();
 });
 it("requires a fresh read after conflicts and displays no success",async()=>{
  mocks.set.mockResolvedValue({ok:false,error:{message:"대표 지정이 바뀌었어요."}});render(<FeaturedTierControl featured={{id,version:2}}/>);
  fireEvent.click(screen.getByRole("button",{name:"대표 지정 해제"}));await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("대표 지정이 바뀌었어요."));
  expect(mocks.refresh).not.toHaveBeenCalled();expect(screen.getByRole("button",{name:"대표 지정 해제"})).toBeDisabled();expect(screen.getByRole("button",{name:"최신 대표 지정 불러오기"})).toBeEnabled();
 });
 it("renders generic spoiler links, without titles/tags/body",()=>{
  // Defense at rendering as well as the stricter DAL contract.
  render(<FeaturedTierCard tier={{id,version:2,publishedVersion:1,publishedAt:"2026-10-05T00:00:00Z",authorId:id,username:"author",name:"작가",isSpoiler:true,title:"spoiler-secret",tags:["spoiler-tag"],likeCount:2,recentLikeCount:0}}/>);
  expect(screen.getByRole("link",{name:"스포일러가 포함된 티어표"})).toHaveAttribute("href",`/tiers/${id}`);expect(screen.getByText(/좋아요 2개/)).toBeVisible();expect(screen.queryByLabelText("대표 티어표 테마")).toBeNull();
 });
});
