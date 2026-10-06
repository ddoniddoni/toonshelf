// Written UI mocks only; no browser, real DB, or permission verification.
import { act,fireEvent,render,screen,waitFor } from "@testing-library/react";
import { beforeEach,describe,expect,it,vi } from "vitest";
const mocks=vi.hoisted(()=>({create:vi.fn(),reveal:vi.fn(),edit:vi.fn(),update:vi.fn(),remove:vi.fn(),report:vi.fn(),refresh:vi.fn()}));
vi.mock("@/lib/comments/actions",()=>({createTierComment:mocks.create,revealTierComment:mocks.reveal,getMyTierComment:mocks.edit,updateTierComment:mocks.update,deleteTierComment:mocks.remove,reportTierComment:mocks.report}));
vi.mock("@/components/reviews/forms",()=>({BlockForm:()=>null}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
import { CommentComposer } from "@/components/comments/comment-composer";
import { CommentItem } from "@/components/comments/comment-item";
const id="20000000-0000-4000-8000-000000000001",tierId="20000000-0000-4000-8000-000000000002";
const comment={id,tierId,parentId:null,version:1,createdAt:"2026-10-05T00:00:00Z",updatedAt:"2026-10-05T00:00:00Z",deleted:false,
 isSpoiler:true,body:null,author:{id,username:"author",name:"작성자"},canEdit:false,canReport:false,canReply:false,replyCount:0};
describe("comment acknowledgements and disclosure",()=>{
 beforeEach(()=>{vi.resetAllMocks();});
 it("keeps input after a lost response and reuses the request ID until acknowledgement",async()=>{
  mocks.create.mockRejectedValueOnce(new Error("connection lost")).mockResolvedValueOnce({ok:true,id});
  render(<CommentComposer tierId={tierId} tierVersion={2}/>);
  const body=screen.getByRole("textbox"),confirm=screen.getByRole("checkbox",{name:"이 댓글이 공개된다는 것을 확인했어요."});
  const spoiler=screen.getByRole("checkbox",{name:"스포일러가 포함돼요. 펼친 뒤 내용을 보여 주세요."});
  fireEvent.change(body,{target:{value:"남겨 둘 댓글"}});fireEvent.click(spoiler);fireEvent.click(confirm);fireEvent.click(screen.getByRole("button",{name:"댓글 등록"}));
  await screen.findByRole("alert");expect(body).toHaveValue("남겨 둘 댓글");expect(spoiler).not.toBeChecked();expect(confirm).toBeChecked();expect(mocks.refresh).not.toHaveBeenCalled();
  const requestId=mocks.create.mock.calls[0][0].id;fireEvent.click(screen.getByRole("button",{name:"댓글 등록"}));
  await screen.findByText("댓글을 등록했어요.");expect(mocks.create.mock.calls[1][0].id).toBe(requestId);expect(mocks.create.mock.calls[1][0].isSpoiler).toBe(false);expect(body).toHaveValue("");expect(mocks.refresh).toHaveBeenCalledTimes(1);
 });
 it("disables duplicate submissions and clears input only after an acknowledged save",async()=>{
  let finish:(value:unknown)=>void=()=>{};mocks.create.mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  render(<CommentComposer tierId={tierId} tierVersion={2}/>);fireEvent.change(screen.getByRole("textbox"),{target:{value:"새 댓글"}});fireEvent.click(screen.getByRole("checkbox",{name:"이 댓글이 공개된다는 것을 확인했어요."}));
  fireEvent.click(screen.getByRole("button",{name:"댓글 등록"}));expect(screen.getByRole("button",{name:"등록 중…"})).toBeDisabled();expect(screen.getByRole("textbox")).toHaveValue("새 댓글");
  fireEvent.click(screen.getByRole("button",{name:"등록 중…"}));expect(mocks.create).toHaveBeenCalledTimes(1);
  await act(async()=>{finish({ok:true,id});});expect(screen.getByRole("textbox")).toHaveValue("");
 });
 it("reveals no initial spoiler text and retains the gate after permission/conflict denial",async()=>{
  mocks.reveal.mockResolvedValueOnce({ok:false,error:{message:"현재 댓글을 펼칠 수 없어요."}}).mockResolvedValueOnce({ok:true,body:"펼친 스포일러"});
  render(<CommentItem comment={comment} tierVersion={2}/>);expect(screen.queryByText("펼친 스포일러")).toBeNull();expect(mocks.reveal).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"스포일러 댓글 펼치기"}));await screen.findByRole("alert");expect(screen.queryByText("펼친 스포일러")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"스포일러 댓글 펼치기"}));await screen.findByText("펼친 스포일러");expect(mocks.reveal).toHaveBeenCalledWith({id,version:1,tierVersion:2,confirm:true});
 });
 it("renders plain text safely, retains tombstone reply links, and clears reveals after revisions",async()=>{
  mocks.reveal.mockResolvedValue({ok:true,body:"옛 스포일러"});const {rerender}=render(<CommentItem comment={comment} tierVersion={2}/>);
  fireEvent.click(screen.getByRole("button",{name:"스포일러 댓글 펼치기"}));await screen.findByText("옛 스포일러");
  rerender(<CommentItem comment={{...comment,version:2}} tierVersion={2}/>);await waitFor(()=>expect(screen.queryByText("옛 스포일러")).toBeNull());
  rerender(<CommentItem comment={{...comment,isSpoiler:false,body:"<script>alert(1)</script>"}} tierVersion={2}/>);expect(screen.getByText("<script>alert(1)</script>")).toBeVisible();expect(document.querySelector("script")).toBeNull();
  rerender(<CommentItem comment={{...comment,deleted:true,author:null,replyCount:2}} tierVersion={2}/>);
  expect(screen.queryByText("작성자")).toBeNull();expect(screen.queryByRole("button")).toBeNull();expect(screen.getByRole("link",{name:"답글 2개 보기 →"})).toHaveAttribute("href",`/tiers/${tierId}/comments?parent=${id}#comments`);
 });
 it("retains edited text and spoiler choice after a resolved conflict response",async()=>{
  mocks.edit.mockResolvedValue({ok:true,editor:{id,version:1,body:"원래 댓글",isSpoiler:true}});mocks.update.mockResolvedValue({ok:false,error:{message:"다른 화면에서 댓글이 변경됐어요."}});
  render(<CommentItem comment={{...comment,canEdit:true}} tierVersion={2}/>);fireEvent.click(screen.getByRole("button",{name:"내 댓글 수정"}));
  const body=await screen.findByRole("textbox",{name:"내 댓글 수정 (1~1000자)"}),spoiler=screen.getByRole("checkbox",{name:"내 댓글에 스포일러가 포함돼요."});
  fireEvent.change(body,{target:{value:"보존할 수정 내용"}});fireEvent.click(spoiler);fireEvent.click(screen.getByRole("checkbox",{name:"수정한 내용을 공개할게요."}));fireEvent.click(screen.getByRole("button",{name:"댓글 수정 저장"}));
  await screen.findByText("다른 화면에서 댓글이 변경됐어요.");expect(body).toHaveValue("보존할 수정 내용");expect(spoiler).not.toBeChecked();expect(mocks.refresh).not.toHaveBeenCalled();
 });
});
