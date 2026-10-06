import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { AuthFailure } from "@/lib/auth/errors";
import { catalogueError } from "./errors";
import { readCursor,writeCursor } from "./cursor";
import { detailSchema,filtersSchema,genreSchema,platformSchema,searchResponseSchema,slugSchema,type CatalogueFilters } from "./model";

export const catalogueOptions = cache(async ()=>{
  if (!getPublicEnv().supabase) return null;
  const client = await createClient();
  const [platforms,genres] = await Promise.all([
    client.from("toon_platforms").select("id,code,name,approved_hosts,active").eq("active",true).order("name"),
    client.from("toon_genres").select("id,slug,name").eq("active",true).order("sort_order")
  ]);
  catalogueError(platforms.error);catalogueError(genres.error);
  return {platforms:z.array(platformSchema).parse(platforms.data),genres:z.array(genreSchema).parse(genres.data)};
});
export async function searchWorks(filters:CatalogueFilters,cursor:unknown,limit=24) {
  filters = filtersSchema.parse(filters);
  limit = z.number().int().min(1).max(50).parse(limit);
  const after = readCursor(cursor,filters);
  const client = await createClient();
  const {data,error} = await client.rpc("toon_search_catalogue",{p_q:filters.q,p_platforms:filters.platform,p_genres:filters.genre,p_status:filters.status,
    p_days:filters.day,p_age:filters.age,p_sort:filters.sort,p_after:after,p_limit:limit});
  if (error?.message === "VALIDATION_ERROR") throw new AuthFailure("VALIDATION_ERROR","검색 조건이나 페이지 주소를 다시 확인해 주세요. 공개 평가가 바뀌었다면 첫 페이지부터 찾아 주세요.");
  catalogueError(error);
  const result = searchResponseSchema.parse(data);
  return {items:result.items,total:result.total,nextCursor:writeCursor(result.next,filters)};
}
export const getWorkDetail = cache(async (slug:string)=>{
  if (!slugSchema.safeParse(slug).success || !getPublicEnv().supabase) return null;
  const {data,error} = await (await createClient()).rpc("toon_get_catalogue_detail",{p_slug:slug});
  catalogueError(error);
  return data === null ? null : detailSchema.parse(data);
});
