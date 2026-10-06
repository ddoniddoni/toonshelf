import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { catalogueError } from "./errors";
import { uuidSchema } from "./model";

const accessSchema = z.object({path:z.string().regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}\.webp$/),attribution:z.string(),commercialAllowed:z.boolean()});
// P4/P6 renderers must request their own purpose; display permission is insufficient.
export async function getCoverAccess(assetId:string,purpose:"display"|"og"|"export") {
  const id = uuidSchema.parse(assetId);
  const {data,error} = await (await createClient()).rpc("toon_get_cover_access",{p_asset:id,p_purpose:purpose});
  catalogueError(error);
  return data === null ? null : accessSchema.parse(data);
}
