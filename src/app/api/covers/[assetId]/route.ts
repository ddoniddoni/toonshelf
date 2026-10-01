import { createAdminClient } from "@/lib/supabase/admin";
import { getCoverAccess } from "@/lib/catalogue/covers";
import { uuidSchema } from "@/lib/catalogue/model";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
export async function GET(_request:Request,{params}:{params:Promise<{assetId:string}>}) {
  const {assetId} = await params;
  if (!uuidSchema.safeParse(assetId).success) return new Response(null,{status:404,headers});
  try {
    const access = await getCoverAccess(assetId,"display");
    if (!access) return new Response(null,{status:404,headers});
    const {data,error} = await createAdminClient().storage.from("licensed-covers").download(access.path);
    if (error || !data || data.size > 2097152) return new Response(null,{status:404,headers});
    // A revocation or visibility change during Storage I/O cancels this response.
    const current = await getCoverAccess(assetId,"display");
    if (!current || current.path !== access.path) return new Response(null,{status:404,headers});
    return new Response(await data.arrayBuffer(),{headers:{...headers,"Content-Type":"image/webp","Content-Length":String(data.size)}});
  } catch { return new Response(null,{status:503,headers}); }
}
