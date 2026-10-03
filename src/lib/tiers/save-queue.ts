import { draftSchema,type SaveReply,type TierDraft,type TierWorks } from "./model";
export type SaveState = {dirty:boolean;saving:boolean;version:number;savedAt:string;failure:Extract<SaveReply,{ok:false}>|null};
// The request is never aborted: an aborted response does not undo a DB commit.
export class DraftSaveQueue {
 private latest:TierDraft;
 private revision=0;
 private savedRevision=0;
 private timer:ReturnType<typeof setTimeout>|null=null;
 private ready=false;
 private disposed=false;
 private state:SaveState;
 constructor(draft:TierDraft,version:number,savedAt:string,
  private send:(draft:TierDraft,version:number)=>Promise<SaveReply>,
  private notify:(state:SaveState,canonical?:TierDraft,works?:TierWorks)=>void) {
  this.latest=draft;this.state={dirty:false,saving:false,version,savedAt,failure:null};
 }
 update(draft:TierDraft) {
  if (this.disposed || JSON.stringify(this.latest) === JSON.stringify(draft)) return;
  this.latest=draft;this.revision++;this.state.dirty=true;
  const parsed=draftSchema.safeParse(draft);
  if (!parsed.success && !this.state.failure?.conflict) this.state.failure={ok:false,error:{code:"VALIDATION_ERROR",message:parsed.error.issues[0]?.message ?? "초안 내용을 확인해 주세요."}};
  else if (this.state.failure?.error.code === "VALIDATION_ERROR") this.state.failure=null;
  this.emit();
  this.clearTimer();this.ready=false;
  if (!this.state.failure) this.timer=setTimeout(()=>{this.timer=null;this.ready=true;void this.flush();},800);
 }
 manual() {
  if (this.disposed || this.state.failure?.conflict || !draftSchema.safeParse(this.latest).success) return;
  this.clearTimer();this.state.failure=null;this.ready=true;void this.flush();
 }
 reset(draft:TierDraft,version:number,savedAt:string) {
  if (this.state.saving) return false;
  this.clearTimer();this.latest=draft;this.revision=0;this.savedRevision=0;this.ready=false;
  this.state={dirty:false,saving:false,version,savedAt,failure:null};this.emit(draft);return true;
 }
 dispose() {this.disposed=true;this.clearTimer();}
 private clearTimer() {if (this.timer !== null) clearTimeout(this.timer);this.timer=null;}
 private emit(canonical?:TierDraft,works?:TierWorks) {if (!this.disposed) this.notify({...this.state},canonical,works);}
 private async flush() {
  if (this.disposed || this.state.saving || this.state.failure || !this.ready || this.revision === this.savedRevision) return;
  const revision=this.revision,draft=this.latest;this.ready=false;this.state.saving=true;this.emit();
  let reply:SaveReply;
  try {reply=await this.send(draft,this.state.version);} catch {reply={ok:false,error:{code:"INTERNAL_ERROR",message:"연결을 확인하고 다시 저장해 주세요. 변경 내용은 이 화면에 남아 있어요."}};}
  if (this.disposed) return;
  this.state.saving=false;
  if (!reply.ok) {this.state.failure=reply;this.state.dirty=true;this.clearTimer();this.emit();return;}
  this.savedRevision=revision;this.state.version=reply.version;this.state.savedAt=reply.savedAt;
  this.state.dirty=this.revision !== revision;
  if (!this.state.dirty) {this.latest=reply.draft;this.emit(reply.draft,reply.works);} else this.emit(undefined,reply.works);
  if (this.state.dirty && this.ready) void this.flush();
 }
}
