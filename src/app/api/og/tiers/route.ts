import { genericTierOg } from "@/lib/tiers/image-render";
import { imageErrorResponse,tierImageHeaders } from "@/lib/tiers/image-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
// One shared generic card for all unlisted links; never an ID or token URL.
export async function GET(request:Request) {
  try {
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20_000)]);
    const bytes=await genericTierOg();signal.throwIfAborted();
    return new Response(new Uint8Array(bytes),{headers:{...tierImageHeaders,"Content-Type":"image/png"}});
  } catch(error) {return imageErrorResponse(error);}
}
