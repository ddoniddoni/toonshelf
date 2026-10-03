import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { defaultDraft,type SaveReply } from "@/lib/tiers/model";
import { DraftSaveQueue } from "@/lib/tiers/save-queue";
let n=0;const initial=defaultDraft(()=>`10000000-0000-4000-8000-${String(++n).padStart(12,"0")}`);
const success=(version:number,title:string):SaveReply=>({ok:true,version,savedAt:"2026-10-03T00:00:00Z",draft:{...initial,title},works:[]});
describe("single flight tier autosave",()=>{
 beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
 it("debounces for 800ms, sends latest edits only after acknowledgement, and uses the new version",async()=>{
  const pending:((reply:SaveReply)=>void)[]=[];
  const send=vi.fn(()=>new Promise<SaveReply>(resolve=>pending.push(resolve))),notify=vi.fn();
  const queue=new DraftSaveQueue(initial,1,"initial",send,notify);
  queue.update({...initial,title:"first"});await vi.advanceTimersByTimeAsync(799);expect(send).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);expect(send).toHaveBeenCalledTimes(1);
  queue.update({...initial,title:"second"});queue.update({...initial,title:"latest"});await vi.advanceTimersByTimeAsync(800);
  expect(send).toHaveBeenCalledTimes(1);pending[0](success(2,"first"));await vi.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledTimes(2);expect(send.mock.calls[1]).toEqual([{...initial,title:"latest"},2]);
  expect(notify.mock.calls.some(([,canonical])=>canonical?.title === "first")).toBe(false);
  pending[1](success(3,"latest"));await vi.advanceTimersByTimeAsync(0);expect(notify.mock.calls.at(-1)?.[0]).toMatchObject({dirty:false,version:3});queue.dispose();
 });
 it("pauses a version conflict even after manual save and further edits",async()=>{
  const reply:SaveReply={ok:false,error:{code:"CONFLICT",message:"conflict"},conflict:{version:2,savedAt:"newer"}};
  const send=vi.fn().mockResolvedValue(reply),queue=new DraftSaveQueue(initial,1,"initial",send,vi.fn());
  queue.update({...initial,title:"edited"});await vi.advanceTimersByTimeAsync(800);queue.manual();queue.update({...initial,title:""});queue.update({...initial,title:"again"});await vi.advanceTimersByTimeAsync(1600);
  expect(send).toHaveBeenCalledTimes(1);queue.reset(initial,2,"newer");queue.update({...initial,title:"retry"});await vi.advanceTimersByTimeAsync(800);
  expect(send.mock.calls.at(-1)?.[1]).toBe(2);queue.dispose();
 });
 it("retains failed edits, requires an explicit retry, and suppresses callbacks/queued requests after disposal",async()=>{
  let resolve!:(reply:SaveReply)=>void;
  const send=vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation(()=>new Promise<SaveReply>(r=>{resolve=r;})),notify=vi.fn();
  const queue=new DraftSaveQueue(initial,1,"initial",send,notify);queue.update({...initial,title:"offline edit"});await vi.advanceTimersByTimeAsync(800);
  expect(notify.mock.calls.at(-1)?.[0]).toMatchObject({dirty:true,failure:{ok:false}});queue.manual();expect(send).toHaveBeenCalledTimes(2);
  queue.update({...initial,title:"later edit"});queue.dispose();const count=notify.mock.calls.length;resolve(success(2,"offline edit"));await vi.advanceTimersByTimeAsync(1600);
  expect(send).toHaveBeenCalledTimes(2);expect(notify).toHaveBeenCalledTimes(count);
 });
 it("does not send invalid transient input and resumes after the input becomes valid",async()=>{
  const send=vi.fn().mockResolvedValue(success(2,"valid")),queue=new DraftSaveQueue(initial,1,"initial",send,vi.fn());
  queue.update({...initial,title:""});await vi.advanceTimersByTimeAsync(800);expect(send).not.toHaveBeenCalled();
  queue.update({...initial,title:"valid"});await vi.advanceTimersByTimeAsync(800);expect(send).toHaveBeenCalledTimes(1);queue.dispose();
 });
});
