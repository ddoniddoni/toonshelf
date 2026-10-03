import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import type { TierPublication } from "@/lib/tiers/publication-model";
import { BlockForm } from "@/components/reviews/forms";
import { PublicationBoard } from "./publication-board";
import { TierPublicationGate } from "./publication-gate";
import { CloneTierForm,ReportTierForm } from "./publication-forms";
import { PublicationShare } from "./publication-share";
import { TierImageExport } from "./image-export";
export async function PublicationDetail({publication,token=null}:{publication:TierPublication;token?:string|null}) {
 const account=await getCurrentAccount(),own=account?.user.id === publication.authorId;
 const active=account?.access.status === "active" && account.access.consents_current && Boolean(account.user.email_confirmed_at);
 return <article className="page-container tier-list-page"><Link className="text-link" href="/tiers">← 공개 티어표</Link><p className="eyebrow">TASTE MAP</p><h1>{token ? "링크로 공유된 티어표" : "공개 티어표"}</h1><p><Link href={`/u/${publication.username}`} prefetch={false} className="text-link">{publication.name}</Link> · 게시본 {publication.publishedVersion} · <time dateTime={publication.publishedAt}>{new Date(publication.publishedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})}</time></p>
  {publication.body ? <PublicationBoard body={publication.body}/> : <TierPublicationGate key={publication.version} id={publication.id} version={publication.version} token={token}/>}
  <PublicationShare/>
  {active ? <TierImageExport id={publication.id} version={publication.version} source="publication" token={token} isSpoiler={publication.isSpoiler}/> : <p><Link className="text-link" href="/auth/sign-in">로그인</Link>하면 게시본을 PNG로 저장할 수 있어요.</p>}
  {own ? <Link href={`/tiers/${publication.id}/publish`} className="button button-secondary">내 게시·공유 설정</Link> : null}
  {active ? <details className="library-privacy-panel"><summary>내 티어표로 복사</summary><CloneTierForm id={publication.id} version={publication.version} token={token}/></details> : <p><Link className="text-link" href="/auth/sign-in">로그인</Link>하면 현재 게시본을 내 비공개 티어표로 복사할 수 있어요.</p>}
  {active && !own ? <><details className="library-privacy-panel"><summary>티어표 신고</summary><ReportTierForm id={publication.id} token={token}/></details><details className="library-privacy-panel"><summary>작성자 차단</summary><BlockForm userId={publication.authorId} name={publication.name}/></details></> : null}
  <p className="field-hint">배치는 개인 별점·기본 티어와 따로 기록돼요. 현재 제공되지 않는 작품은 대체 카드로 표시해요.</p>
 </article>;
}
