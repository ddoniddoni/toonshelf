import { AuthFailure } from "@/lib/auth/errors";
import { uuidSchema } from "@/lib/catalogue/model";
import { getTierPublication } from "@/lib/tiers/publication-data";
import { imageSourceSchema } from "@/lib/tiers/image-model";
import { renderTierOg,genericTierOg } from "@/lib/tiers/image-render";
import { imageErrorResponse,imageFingerprint,tierImageHeaders } from "@/lib/tiers/image-http";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    if (!uuidSchema.safeParse(id).success || new URL(request.url).search)
      throw new AuthFailure("NOT_FOUND","공유 카드를 찾을 수 없어요.");
    // No hash/token is accepted. The current public reader omits spoiler bodies.
    const publication=await getTierPublication(id);
    if (!publication) throw new AuthFailure("NOT_FOUND","공유 카드를 찾을 수 없어요.");
    const source=publication.body === null ? null : imageSourceSchema.parse({
      id,version:publication.version,source:"publication",isSpoiler:false,unplaced:[],body:{...publication.body,
        rows:publication.body.rows.map(row=>({...row,items:row.items.map(work=>work ? {title:work.title} : null)})),
      },
    });
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20_000)]);
    const bytes=source === null ? await genericTierOg() : await renderTierOg(source,signal);
    const latest=await getTierPublication(id);
    if (!latest) throw new AuthFailure("NOT_FOUND","공유 카드를 찾을 수 없어요.");
    if (imageFingerprint(publication) !== imageFingerprint(latest)) throw new AuthFailure("CONFLICT","티어표가 바뀌었어요. 다시 열어 주세요.");
    signal.throwIfAborted();
    return new Response(new Uint8Array(bytes),{headers:{...tierImageHeaders,"Content-Type":"image/png"}});
  } catch(error) {return imageErrorResponse(error);}
}
