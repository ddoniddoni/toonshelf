import "server-only";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { libraryError } from "./errors";
import { libraryResponseSchema,publicLibrarySchema,publicLibraryFiltersSchema,recordSchema,statsSchema,workStatsSchema,type LibraryFilters,type PublicLibraryFilters } from "./model";
export async function getMyRecord(workId:string) {
 const {client} = await requireAccount();
 const {data,error} = await client.rpc("toon_get_my_reading_record",{p_work:workId});
 libraryError(error); return data === null ? null : recordSchema.parse(data);
}
export async function getMyLibrary(filters:LibraryFilters,page:number) {
 const {client} = await requireAccount();
 const {data,error} = await client.rpc("toon_get_my_library",{p_filters:filters,p_page:page});
 libraryError(error);return libraryResponseSchema.parse(data);
}
export async function getPublicLibrary(username:string,page:number,filters?:PublicLibraryFilters) {
 const publicFilters = filters ? publicLibraryFiltersSchema.parse(filters) : null;
 const client = await createClient();
 const {data,error} = publicFilters
  ? await client.rpc("toon_search_public_library",{p_username:username,p_page:page,p_filters:publicFilters})
  : await client.rpc("toon_get_public_library",{p_username:username,p_page:page});
 libraryError(error);return data === null ? null : publicLibrarySchema.parse(data);
}
export async function getReadingStats(username:string|null=null) {
 const client = username === null ? (await requireAccount()).client : await createClient();
 const {data,error} = await client.rpc("toon_get_reading_stats",{p_username:username});
 libraryError(error);return data === null ? null : statsSchema.parse(data);
}
export async function getWorkStats(workId:string) {
 const {data,error} = await (await createClient()).rpc("toon_get_work_evaluation_stats",{p_work:workId});
 libraryError(error);return data === null ? null : workStatsSchema.parse(data);
}
