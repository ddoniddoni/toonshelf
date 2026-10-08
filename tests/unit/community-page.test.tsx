// Written only. No browser or live database request is performed by these mocks.
import { render,screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({list:vi.fn(),connected:true}));
vi.mock("@/lib/posts/data",()=>({listPosts:mocks.list}));
vi.mock("@/lib/env/public",()=>({getPublicEnv:()=>({supabase:mocks.connected})}));
vi.mock("next/link",()=>({default:({children,href}:PropsWithChildren<{href:string}>)=><a href={href}>{children}</a>}));
vi.mock("@/components/posts/post-list",()=>({PostList:()=>null}));
import Page from "@/app/community/page";
import { AuthFailure } from "@/lib/auth/errors";

describe("community availability (written only)",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.connected=true;});
 it("shows a preparation notice for a missing RPC, without claiming an empty community",async()=>{
  mocks.list.mockRejectedValue(new AuthFailure("CONFIG_REQUIRED","private database detail"));
  const params={q:"추천",category:"general",sort:"popular",page:"2",work:"35000000-0000-4000-8000-000000000001"};
  render(await Page({searchParams:Promise.resolve(params)}));
  expect(screen.getByRole("heading",{name:"커뮤니티를 준비하고 있어요"})).toBeVisible();
  expect(screen.queryByText("아직 이곳에 이야기가 없어요")).toBeNull();
  expect(screen.queryByRole("link",{name:"글 쓰기"})).toBeNull();
  expect(screen.queryByRole("link",{name:"내 글과 초안"})).toBeNull();
  expect(screen.queryByText("private database detail")).toBeNull();
  const retry=screen.getByRole("button",{name:"다시 불러오기"}).closest("form")!;
  expect(retry).toHaveAttribute("action","/community");
  expect(retry).toHaveAttribute("method","get");
  const fields=new FormData(retry);
  for(const [key,value] of Object.entries(params))expect(fields.get(key)).toBe(value);
 });
 it("uses the community notice without a connection and makes no database call",async()=>{
  mocks.connected=false;
  render(await Page({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("heading",{name:"커뮤니티를 준비하고 있어요"})).toBeVisible();
  expect(mocks.list).not.toHaveBeenCalled();
 });
 it("restores writing and the real empty result once the list query succeeds",async()=>{
  mocks.list.mockResolvedValue({items:[],hasNext:false});
  render(await Page({searchParams:Promise.resolve({})}));
  expect(screen.getByRole("link",{name:"글 쓰기"})).toHaveAttribute("href","/community/new");
  expect(screen.getByText("아직 이곳에 이야기가 없어요")).toBeVisible();
  expect(screen.queryByRole("button",{name:"다시 불러오기"})).toBeNull();
 });
 it("keeps unexpected database errors visible to the error boundary",async()=>{
  const error=new AuthFailure("INTERNAL_ERROR","unavailable");mocks.list.mockRejectedValue(error);
  await expect(Page({searchParams:Promise.resolve({})})).rejects.toBe(error);
 });
});
