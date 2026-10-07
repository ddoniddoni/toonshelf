// Written server component/UI mocks only; no browser or live permission checks.
import { render,screen } from "@testing-library/react";
import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({list:vi.fn()}));
vi.mock("@/lib/tiers/publication-data",()=>({listPublicTiers:mocks.list}));
import { PublicationFeed } from "@/components/tiers/publication-feed";
import { tierDiscoveryUrl } from "@/lib/tiers/discovery-model";
const id="20000000-0000-4000-8000-000000000001",filters={sort:"popular" as const,tag:"판타지"};
const card={id,version:2,publishedVersion:1,publishedAt:"2026-10-05T00:00:00Z",authorId:id,username:"author",name:"작가",isSpoiler:false,title:"공개 표",tags:["로맨스 & 우정"],likeCount:30,recentLikeCount:2,recentCommenterCount:3,popularityScore:8};
describe("tier discovery feed",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.list.mockResolvedValue({items:[card],hasNext:true});});
 it("distinguishes total/recent counts and retains filters across navigation",async()=>{
  render(await PublicationFeed({page:2,filters}));expect(mocks.list).toHaveBeenCalledWith(2,filters);
  expect(screen.getByText("좋아요 30개")).toBeVisible();expect(screen.getByText("최근 7일: 좋아요 2개 · 댓글 참여 3명 · 인기 점수 8점")).toBeVisible();
  expect(screen.getByRole("combobox",{name:"정렬"})).toHaveValue("popular");expect(screen.getByRole("option",{name:"최근 7일 인기순"})).toBeVisible();
  expect(screen.getByRole("link",{name:"이전"})).toHaveAttribute("href",tierDiscoveryUrl(filters));expect(screen.getByRole("link",{name:"다음"})).toHaveAttribute("href",tierDiscoveryUrl(filters,3));
  expect(screen.getByRole("link",{name:"#로맨스 & 우정"})).toHaveAttribute("href",tierDiscoveryUrl({...filters,tag:card.tags[0]!}));
  const form=screen.getByRole("form",{name:"공개 티어표 탐색 조건"});expect(form).toHaveAttribute("method","get");expect(form).toHaveAttribute("action","/tiers");expect(form.querySelector('[name="page"]')).toBeNull();
 });
 it("keeps spoiler cards generic and offers a same-filter recovery from an empty page",async()=>{
  mocks.list.mockResolvedValue({items:[{...card,isSpoiler:true,title:null,tags:null}],hasNext:false});
  const view=render(await PublicationFeed({page:1,filters:{sort:"latest",tag:null}}));expect(screen.getByRole("link",{name:"스포일러가 포함된 티어표"})).toBeVisible();expect(screen.queryByText(/#로맨스/)).toBeNull();
  expect(screen.queryByText(/인기 점수 8점/)).toBeNull();
  mocks.list.mockResolvedValue({items:[],hasNext:false});view.rerender(await PublicationFeed({page:3,filters}));
  expect(screen.getByRole("link",{name:"같은 조건의 첫 페이지"})).toHaveAttribute("href",tierDiscoveryUrl(filters));expect(screen.queryByRole("link",{name:"다음"})).toBeNull();
 });
 it("shows setup rather than fake items, and disables unconnected filters",async()=>{
  mocks.list.mockResolvedValue(null);render(await PublicationFeed({page:1,filters}));expect(screen.getByText("서비스 연결 후 공개된 티어표를 볼 수 있어요.")).toBeVisible();
  expect(screen.getByRole("button",{name:"조건 적용"})).toBeDisabled();expect(screen.queryByRole("link",{name:"현재 게시본 보기 →"})).toBeNull();
 });
 it("displays computed zero participation rather than inventing popularity",async()=>{
  mocks.list.mockResolvedValue({items:[{...card,likeCount:0,recentLikeCount:0,recentCommenterCount:0,popularityScore:0}],hasNext:false});
  render(await PublicationFeed({page:1,filters}));expect(screen.getByText("최근 7일: 좋아요 0개 · 댓글 참여 0명 · 인기 점수 0점")).toBeVisible();
 });
});
