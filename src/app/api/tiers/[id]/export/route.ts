import { uuidSchema } from "@/lib/catalogue/model";
import { readTierImageSource } from "@/lib/tiers/image-data";
import { renderTierPngs } from "@/lib/tiers/image-render";
import { zipTierPngs } from "@/lib/tiers/image-zip";
import { imageErrorResponse,readImageRequest,sameImageSource,tierImageHeaders } from "@/lib/tiers/image-http";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;uuidSchema.parse(id);
    const input=await readImageRequest(request);
    const signal=AbortSignal.any([request.signal,AbortSignal.timeout(45_000)]);
    signal.throwIfAborted();
    const source=await readTierImageSource(id,input,true); // Committed rate reservation before image work.
    const images=await renderTierPngs(source,signal);
    const latest=await readTierImageSource(id,input);
    sameImageSource(source,latest);signal.throwIfAborted();
    const multiple=images.length > 1,bytes=multiple ? zipTierPngs(images) : images[0]!;
    return new Response(new Uint8Array(bytes),{headers:{...tierImageHeaders,
      "Content-Type":multiple ? "application/zip" : "image/png",
      "Content-Disposition":`attachment; filename="toonshelf-${source.source}-v${source.version}.${multiple ? "zip" : "png"}"`,
      "X-ToonShelf-Pages":String(images.length),
    }});
  } catch(error) {return imageErrorResponse(error);}
}
