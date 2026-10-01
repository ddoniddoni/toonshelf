import "server-only";
import { cache } from "react";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { catalogueError } from "./errors";
import { readCursor,writeCursor } from "./cursor";
import { detailSchema,genreSchema,platformSchema,searchResponseSchema,slugSchema,type CatalogueFilters } from "./model";

export const catalogueOptions = cache(async ()=>{
  if (!getPublicEnv().supabase) return null;
  const client = await createClient();
  const [platforms,genres] = await Promise.all([
    client.from("platforms").select("id,code,name,approved_hosts,active").eq("active",true).order("name"),
    client.from("genres").select("id,slug,name").eq("active",true).order("sort_order")
  ]);
  catalogueError(platforms.error);catalogueError(genres.error);
  return {platforms:z.array(platformSchema).parse(platforms.data),genres:z.array(genreSchema).parse(genres.data)};
});
export async function searchWorks(filters:CatalogueFilters,cursor:unknown,limit=24) {
  const after = readCursor(cursor,filters);
  const client = await createClient();
  const {data,error} = await client.rpc("search_catalogue",{p_q:filters.q,p_platforms:filters.platform,p_genres:filters.genre,p_status:filters.status,
    p_days:filters.day,p_age:filters.age,p_sort:filters.sort,p_after:after,p_limit:limit});
  catalogueError(error);
  const result = searchResponseSchema.parse(data);
  return {items:result.items,total:result.total,nextCursor:writeCursor(result.next,filters)};
}
export const getWorkDetail = cache(async (slug:string)=>{
  if (!slugSchema.safeParse(slug).success || !getPublicEnv().supabase) return null;
  const {data,error} = await (await createClient()).rpc("get_catalogue_detail",{p_slug:slug});
  catalogueError(error);
  return data === null ? null : detailSchema.parse(data);
});
